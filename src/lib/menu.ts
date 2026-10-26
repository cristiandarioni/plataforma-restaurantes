import { sql } from "./db";
import { INCLUDED_SLOTS, type Category, type Item, type Restaurant, type Shift, type Slot, type Supply, type Table } from "./menu-shared";
import { currentShift, localNow } from "./time";

export * from "./menu-shared";

export async function getRestaurantBySlug(slug: string) {
  const [r] = await sql<Restaurant[]>`select * from restaurants where slug = ${slug}`;
  return r ?? null;
}

export async function getRestaurantByTableCode(code: string) {
  const [row] = await sql<{ slug: string; label: string }[]>`
    select r.slug, t.label from tables t join restaurants r on r.id = t.restaurant_id
    where t.code = ${code.toUpperCase()}`;
  return row ?? null;
}

export async function loadRestaurantData(restaurantId: string) {
  const [shifts, categories, supplies, items, tables] = await Promise.all([
    sql<Shift[]>`select id, name, to_char(starts_at, 'HH24:MI') as starts_at, to_char(ends_at, 'HH24:MI') as ends_at, sort
                 from shifts where restaurant_id = ${restaurantId} order by starts_at`,
    sql<Category[]>`select id, shift_id, name, daily_options, sort from categories
                    where restaurant_id = ${restaurantId} order by sort, name`,
    sql<Supply[]>`select id, name, sold_out_until, sort from supplies
                  where restaurant_id = ${restaurantId} order by sort, name`,
    sql<Item[]>`select i.id, i.category_id, i.kind, i.slot, i.name, i.description, i.price, i.sold_out_until,
                       i.active, i.sort,
                       coalesce(array_agg(s.supply_id) filter (where s.supply_id is not null), '{}') as supply_ids
                from items i left join item_supplies s on s.item_id = i.id
                where i.restaurant_id = ${restaurantId}
                group by i.id order by i.sort, i.name`,
    sql<Table[]>`select id, label, code, sort from tables where restaurant_id = ${restaurantId} order by sort, label`,
  ]);
  return { shifts, categories, supplies, items, tables };
}

export type RestaurantData = Awaited<ReturnType<typeof loadRestaurantData>>;

export function isSupplyOut(s: Supply, now = new Date()) {
  return s.sold_out_until != null && new Date(s.sold_out_until) > now;
}

/** Un plato está agotado si se agotó él mismo o cualquiera de sus insumos críticos. */
export function isItemOut(item: Item, supplies: Supply[], now = new Date()) {
  if (item.sold_out_until && new Date(item.sold_out_until) > now) return true;
  return item.supply_ids.some((id) => {
    const s = supplies.find((x) => x.id === id);
    return s ? isSupplyOut(s, now) : false;
  });
}

export async function getDailyMenu(restaurantId: string, day: string) {
  const [row] = await sql<{ item_ids: string[]; note: string | null; published_at: Date | null }[]>`
    select item_ids, note, published_at from daily_menus where restaurant_id = ${restaurantId} and day = ${day}`;
  return row ?? null;
}

/** Último menú del día guardado antes de esta fecha: se usa para precargar el de hoy. */
export async function getPreviousDailyMenu(restaurantId: string, day: string) {
  const [row] = await sql<{ item_ids: string[]; note: string | null }[]>`
    select item_ids, note from daily_menus where restaurant_id = ${restaurantId} and day < ${day}
    order by day desc limit 1`;
  return row ?? null;
}

export type MenuItemView = Item & { soldOut: boolean };

export type DailyView = {
  published: boolean;
  note: string | null;
  included: { slot: Slot; items: MenuItemView[] }[];
  options: MenuItemView[];
};

/** Arma el menú que ve el cliente: carta del turno vigente, agotados y menú del día. */
export async function buildPublicMenu(r: Restaurant, data: RestaurantData, now = new Date()) {
  const { date } = localNow(r.timezone, now);
  const { shift, open } = currentShift(data.shifts, r.timezone, now);
  const view = (i: Item): MenuItemView => ({ ...i, soldOut: isItemOut(i, data.supplies, now) });
  const visible = (i: MenuItemView) => i.active && !(i.soldOut && r.sold_out_display === "hide");

  const inShift = data.categories.filter((c) => !shift || !c.shift_id || c.shift_id === shift.id);
  const sections = inShift
    .filter((c) => !c.daily_options)
    .map((c) => ({
      category: c,
      items: data.items.filter((i) => i.kind === "fijo" && i.category_id === c.id).map(view).filter(visible),
    }))
    .filter((s) => s.items.length > 0);

  let daily: DailyView | null = null;
  const optionCats = inShift.filter((c) => c.daily_options);
  if (optionCats.length > 0) {
    const menu = await getDailyMenu(r.id, date);
    const selected = (menu?.published_at ? menu.item_ids : [])
      .map((id) => data.items.find((i) => i.id === id))
      .filter((i): i is Item => !!i)
      .map(view);
    const fixedOptions = data.items
      .filter((i) => i.kind === "fijo" && optionCats.some((c) => c.id === i.category_id))
      .map(view);
    daily = {
      published: !!menu?.published_at,
      note: menu?.published_at ? menu.note : null,
      included: INCLUDED_SLOTS.map((slot) => ({ slot, items: selected.filter((i) => i.slot === slot) })).filter(
        (g) => g.items.length > 0,
      ),
      // Los incluidos no se agotan visualmente: si se acaba la sopa, el almuerzo sigue.
      options: [
        ...selected.filter((i) => i.slot === "principal" || i.slot === "veggie"),
        ...fixedOptions,
      ].filter(visible),
    };
  }

  return { date, shift, open, sections, daily };
}

/** Firma que cambia cuando el menú visible cambia (edición, turno, día o reactivación automática). */
export function menuSignature(r: Restaurant, data: RestaurantData, now = new Date()) {
  const { date } = localNow(r.timezone, now);
  const { shift, open } = currentShift(data.shifts, r.timezone, now);
  const out = [
    ...data.supplies.filter((s) => isSupplyOut(s, now)).map((s) => s.id),
    ...data.items.filter((i) => i.sold_out_until && new Date(i.sold_out_until) > now).map((i) => i.id),
  ].join(",");
  return `${r.version}|${date}|${shift?.id ?? ""}|${open}|${out}`;
}
