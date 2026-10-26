"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canAdmin, clearSession, hashPassword, setSession, verifyPassword } from "@/lib/auth";
import { bumpVersion, sql } from "@/lib/db";
import { getRestaurantBySlug, loadRestaurantData, type Slot } from "@/lib/menu";
import { localNow, nextResetAt } from "@/lib/time";

const SLOTS: Slot[] = ["entrada", "principal", "acompanante", "bebida", "veggie"];

async function ctx(slug: string) {
  const r = await getRestaurantBySlug(slug);
  if (!r) throw new Error("Restaurante no encontrado");
  if (!(await canAdmin(r.id))) redirect(`/admin/${slug}/login`);
  return r;
}

function done(slug: string) {
  revalidatePath(`/admin/${slug}`);
  revalidatePath(`/r/${slug}`);
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const opt = (f: FormData, k: string) => str(f, k) || null;
const price = (f: FormData, k: string) => {
  const digits = str(f, k).replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
};

// ---- Sesión ----

export async function login(_prev: string | null, f: FormData) {
  const r = await getRestaurantBySlug(str(f, "slug"));
  if (!r || !verifyPassword(str(f, "password"), r.admin_password_hash)) return "Clave incorrecta";
  await setSession({ role: "admin", restaurantId: r.id });
  redirect(`/admin/${r.slug}`);
}

export async function logout(f: FormData) {
  await clearSession();
  redirect(`/admin/${str(f, "slug")}/login`);
}

// ---- Agotados ----

export async function toggleSupply(f: FormData) {
  const r = await ctx(str(f, "slug"));
  const id = str(f, "id");
  const [s] = await sql<{ sold_out_until: Date | null }[]>`
    select sold_out_until from supplies where id = ${id} and restaurant_id = ${r.id}`;
  if (!s) return;
  const isOut = s.sold_out_until && new Date(s.sold_out_until) > new Date();
  const { shifts } = await loadRestaurantData(r.id);
  const until = isOut ? null : nextResetAt(shifts, r.timezone);
  await sql`update supplies set sold_out_until = ${until} where id = ${id}`;
  await bumpVersion(r.id);
  done(r.slug);
}

export async function toggleItem(f: FormData) {
  const r = await ctx(str(f, "slug"));
  const id = str(f, "id");
  const [i] = await sql<{ sold_out_until: Date | null }[]>`
    select sold_out_until from items where id = ${id} and restaurant_id = ${r.id}`;
  if (!i) return;
  const isOut = i.sold_out_until && new Date(i.sold_out_until) > new Date();
  const { shifts } = await loadRestaurantData(r.id);
  await sql`update items set sold_out_until = ${isOut ? null : nextResetAt(shifts, r.timezone)} where id = ${id}`;
  await bumpVersion(r.id);
  done(r.slug);
}

// ---- Menú del día ----

export async function saveDailyMenu(slug: string, itemIds: string[], note: string, publish: boolean) {
  const r = await ctx(slug);
  const { date } = localNow(r.timezone);
  const valid = await sql<{ id: string }[]>`
    select id from items where restaurant_id = ${r.id} and kind = 'diario' and id = any(${itemIds}::uuid[])`;
  const ids = itemIds.filter((id) => valid.some((v) => v.id === id));
  await sql`
    insert into daily_menus (restaurant_id, day, item_ids, note, published_at)
    values (${r.id}, ${date}, ${ids}, ${note || null}, ${publish ? new Date() : null})
    on conflict (restaurant_id, day) do update
      set item_ids = excluded.item_ids, note = excluded.note,
          published_at = coalesce(excluded.published_at, daily_menus.published_at)`;
  await bumpVersion(r.id);
  done(r.slug);
  return { ok: true, date };
}

/** Agrega una preparación a la biblioteca desde el editor del menú del día. */
export async function addLibraryItem(slug: string, slot: Slot, name: string, priceValue: number | null, supplyIds: string[]) {
  const r = await ctx(slug);
  if (!SLOTS.includes(slot) || !name.trim()) throw new Error("Datos inválidos");
  const [it] = await sql<{ id: string }[]>`
    insert into items (restaurant_id, kind, slot, name, price, sort)
    values (${r.id}, 'diario', ${slot}, ${name.trim()}, ${priceValue}, 1000) returning id`;
  for (const s of supplyIds) {
    await sql`insert into item_supplies (item_id, supply_id)
              select ${it.id}, id from supplies where id = ${s} and restaurant_id = ${r.id}`;
  }
  revalidatePath(`/admin/${r.slug}`);
  return it.id;
}

// ---- Carta ----

export async function saveItem(f: FormData) {
  const r = await ctx(str(f, "slug"));
  const id = opt(f, "id");
  const kind = str(f, "kind") === "diario" ? "diario" : "fijo";
  const slot = kind === "diario" && SLOTS.includes(str(f, "slot") as Slot) ? str(f, "slot") : null;
  const categoryId = kind === "fijo" ? opt(f, "category_id") : null;
  const fields = {
    name: str(f, "name"),
    description: opt(f, "description"),
    price: price(f, "price"),
    active: f.get("active") !== null || !id,
  };
  if (!fields.name) return;
  let itemId = id;
  if (id) {
    await sql`update items set name = ${fields.name}, description = ${fields.description}, price = ${fields.price},
              active = ${fields.active}, category_id = ${categoryId}, slot = ${slot}, kind = ${kind}
              where id = ${id} and restaurant_id = ${r.id}`;
  } else {
    const [it] = await sql<{ id: string }[]>`
      insert into items (restaurant_id, category_id, kind, slot, name, description, price, sort)
      values (${r.id}, ${categoryId}, ${kind}, ${slot}, ${fields.name}, ${fields.description}, ${fields.price},
              (select coalesce(max(sort), 0) + 1 from items where restaurant_id = ${r.id}))
      returning id`;
    itemId = it.id;
  }
  const supplyIds = f.getAll("supply").map(String);
  await sql`delete from item_supplies where item_id = ${itemId!}`;
  for (const s of supplyIds) {
    await sql`insert into item_supplies (item_id, supply_id)
              select ${itemId!}, id from supplies where id = ${s} and restaurant_id = ${r.id}`;
  }
  await bumpVersion(r.id);
  done(r.slug);
}

export async function deleteItem(f: FormData) {
  const r = await ctx(str(f, "slug"));
  await sql`delete from items where id = ${str(f, "id")} and restaurant_id = ${r.id}`;
  await bumpVersion(r.id);
  done(r.slug);
}

export async function saveCategory(f: FormData) {
  const r = await ctx(str(f, "slug"));
  const id = opt(f, "id");
  const name = str(f, "name");
  const shiftId = opt(f, "shift_id");
  const dailyOptions = f.get("daily_options") !== null;
  if (!name) return;
  if (id) {
    await sql`update categories set name = ${name}, shift_id = ${shiftId}, daily_options = ${dailyOptions}
              where id = ${id} and restaurant_id = ${r.id}`;
  } else {
    await sql`insert into categories (restaurant_id, shift_id, name, daily_options, sort)
              values (${r.id}, ${shiftId}, ${name}, ${dailyOptions},
                      (select coalesce(max(sort), 0) + 1 from categories where restaurant_id = ${r.id}))`;
  }
  await bumpVersion(r.id);
  done(r.slug);
}

export async function deleteCategory(f: FormData) {
  const r = await ctx(str(f, "slug"));
  const id = str(f, "id");
  // Los platos de la categoría se borran con ella para no dejar platos huérfanos invisibles.
  await sql`delete from items where category_id = ${id} and restaurant_id = ${r.id}`;
  await sql`delete from categories where id = ${id} and restaurant_id = ${r.id}`;
  await bumpVersion(r.id);
  done(r.slug);
}

// ---- Ajustes ----

export async function saveSettings(f: FormData) {
  const r = await ctx(str(f, "slug"));
  const display = str(f, "sold_out_display") === "hide" ? "hide" : "gray";
  const template = ["clasica", "oscura", "color"].includes(str(f, "image_template")) ? str(f, "image_template") : "clasica";
  const color = /^#[0-9a-fA-F]{6}$/.test(str(f, "primary_color")) ? str(f, "primary_color") : r.primary_color;
  await sql`update restaurants set
      name = ${str(f, "name") || r.name}, tagline = ${opt(f, "tagline")}, address = ${opt(f, "address")},
      phone = ${opt(f, "phone")}, instagram_url = ${opt(f, "instagram_url")},
      google_review_url = ${opt(f, "google_review_url")}, primary_color = ${color},
      sold_out_display = ${display}, image_template = ${template}
    where id = ${r.id}`;
  await bumpVersion(r.id);
  done(r.slug);
}

export async function uploadImage(f: FormData) {
  const r = await ctx(str(f, "slug"));
  const target = str(f, "target") === "bg" ? "bg_upload_id" : "logo_upload_id";
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  // PNG o JPG: son los formatos que acepta el generador de la imagen del menú.
  if (!["image/png", "image/jpeg"].includes(file.type)) throw new Error("Usa una imagen PNG o JPG");
  if (file.size > 4 * 1024 * 1024) throw new Error("La imagen debe pesar menos de 4 MB");
  const data = Buffer.from(await file.arrayBuffer());
  const [u] = await sql<{ id: string }[]>`insert into uploads (mime, data) values (${file.type}, ${data}) returning id`;
  await sql`update restaurants set ${sql(target)} = ${u.id} where id = ${r.id}`;
  await bumpVersion(r.id);
  done(r.slug);
}

export async function removeImage(f: FormData) {
  const r = await ctx(str(f, "slug"));
  const target = str(f, "target") === "bg" ? "bg_upload_id" : "logo_upload_id";
  await sql`update restaurants set ${sql(target)} = null where id = ${r.id}`;
  await bumpVersion(r.id);
  done(r.slug);
}

export async function saveShift(f: FormData) {
  const r = await ctx(str(f, "slug"));
  const id = opt(f, "id");
  const name = str(f, "name");
  const starts = str(f, "starts_at");
  const ends = str(f, "ends_at");
  if (!name || !starts || !ends) return;
  if (id) {
    await sql`update shifts set name = ${name}, starts_at = ${starts}, ends_at = ${ends}
              where id = ${id} and restaurant_id = ${r.id}`;
  } else {
    const [{ count }] = await sql<{ count: number }[]>`select count(*)::int as count from shifts where restaurant_id = ${r.id}`;
    if (count >= 2) return; // Máximo dos turnos (almuerzo y cena)
    await sql`insert into shifts (restaurant_id, name, starts_at, ends_at, sort) values (${r.id}, ${name}, ${starts}, ${ends}, ${count})`;
  }
  await bumpVersion(r.id);
  done(r.slug);
}

export async function deleteShift(f: FormData) {
  const r = await ctx(str(f, "slug"));
  await sql`delete from shifts where id = ${str(f, "id")} and restaurant_id = ${r.id}`;
  await bumpVersion(r.id);
  done(r.slug);
}

export async function addSupply(f: FormData) {
  const r = await ctx(str(f, "slug"));
  const name = str(f, "name");
  if (!name) return;
  await sql`insert into supplies (restaurant_id, name, sort)
            values (${r.id}, ${name}, (select coalesce(max(sort), 0) + 1 from supplies where restaurant_id = ${r.id}))
            on conflict (restaurant_id, name) do nothing`;
  done(r.slug);
}

export async function deleteSupply(f: FormData) {
  const r = await ctx(str(f, "slug"));
  await sql`delete from supplies where id = ${str(f, "id")} and restaurant_id = ${r.id}`;
  await bumpVersion(r.id);
  done(r.slug);
}

export async function changePassword(f: FormData) {
  const r = await ctx(str(f, "slug"));
  const password = str(f, "password");
  if (password.length < 6) throw new Error("La clave debe tener al menos 6 caracteres");
  await sql`update restaurants set admin_password_hash = ${hashPassword(password)} where id = ${r.id}`;
  done(r.slug);
}
