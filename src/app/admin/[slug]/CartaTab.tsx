import { PendingButton } from "@/components/PendingButton";
import { formatPrice } from "@/lib/format";
import { SLOT_LABELS, type Category, type Item, type Restaurant, type RestaurantData, type Slot } from "@/lib/menu";
import { deleteCategory, deleteItem, saveCategory, saveItem } from "./actions";

const SLOTS = Object.keys(SLOT_LABELS) as Slot[];

function ItemForm({
  r,
  data,
  item,
  kind,
  categoryId,
  slot,
}: {
  r: Restaurant;
  data: RestaurantData;
  item?: Item;
  kind: "fijo" | "diario";
  categoryId?: string;
  slot?: Slot;
}) {
  return (
    <form action={saveItem} className="stack" style={{ padding: "12px 0" }}>
      <input type="hidden" name="slug" value={r.slug} />
      <input type="hidden" name="kind" value={kind} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="grid2">
        <label className="field">
          Nombre
          <input type="text" name="name" defaultValue={item?.name} required />
        </label>
        <label className="field">
          Precio {kind === "diario" && "(solo plato del día y veggie)"}
          <input type="text" inputMode="numeric" name="price" defaultValue={item?.price ?? ""} placeholder="Ej: 22000" />
        </label>
      </div>
      <label className="field">
        Descripción (opcional)
        <input type="text" name="description" defaultValue={item?.description ?? ""} />
      </label>
      {kind === "fijo" ? (
        <label className="field">
          Categoría
          <select name="category_id" defaultValue={item?.category_id ?? categoryId}>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="field">
          Lugar en el menú del día
          <select name="slot" defaultValue={item?.slot ?? slot}>
            {SLOTS.map((s) => (
              <option key={s} value={s}>
                {SLOT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      )}
      {data.supplies.length > 0 && (
        <div>
          <div className="muted small">Insumos críticos (si se agota uno, el plato sale del menú)</div>
          <div className="row">
            {data.supplies.map((s) => (
              <label key={s.id} className="check">
                <input type="checkbox" name="supply" value={s.id} defaultChecked={item?.supply_ids.includes(s.id)} />
                {s.name}
              </label>
            ))}
          </div>
        </div>
      )}
      {item && (
        <label className="check">
          <input type="checkbox" name="active" defaultChecked={item.active} /> Visible en el menú
        </label>
      )}
      <div className="row">
        <PendingButton className="btn btn-primary btn-small" pendingText="Guardando…">
          {item ? "Guardar" : "Agregar"}
        </PendingButton>
        {item && (
          <PendingButton className="btn btn-small btn-danger" formAction={deleteItem} confirm={`¿Eliminar "${item.name}"?`}>
            Eliminar
          </PendingButton>
        )}
      </div>
    </form>
  );
}

function ItemRow({ r, data, item }: { r: Restaurant; data: RestaurantData; item: Item }) {
  const uses = data.supplies.filter((s) => item.supply_ids.includes(s.id));
  return (
    <details className="item-edit list-row" style={{ display: "block" }}>
      <summary className="spread">
        <span>
          {item.name}{" "}
          {uses.map((s) => (
            <span key={s.id} className="pill" style={{ marginRight: 4 }}>
              {s.name}
            </span>
          ))}
          {!item.active && <span className="pill pill-bad">Oculto</span>}
        </span>
        <span className="row">
          <strong>{formatPrice(item.price)}</strong>
          <span className="muted small">Editar</span>
        </span>
      </summary>
      <ItemForm r={r} data={data} item={item} kind={item.kind} />
    </details>
  );
}

function CategoryCard({ r, data, c }: { r: Restaurant; data: RestaurantData; c: Category }) {
  const items = data.items.filter((i) => i.kind === "fijo" && i.category_id === c.id);
  return (
    <section className="card">
      <details className="item-edit">
        <summary className="spread">
          <h3 style={{ margin: 0 }}>
            {c.name} {c.daily_options && <span className="pill">Opciones del menú del día</span>}
          </h3>
          <span className="muted small">Editar categoría</span>
        </summary>
        <form action={saveCategory} className="stack" style={{ paddingTop: 12 }}>
          <input type="hidden" name="slug" value={r.slug} />
          <input type="hidden" name="id" value={c.id} />
          <CategoryFields data={data} c={c} />
          <div className="row">
            <PendingButton className="btn btn-primary btn-small">Guardar</PendingButton>
            <PendingButton
              className="btn btn-small btn-danger"
              formAction={deleteCategory}
              confirm={`¿Eliminar "${c.name}" y sus ${items.length} platos?`}
            >
              Eliminar categoría y sus platos
            </PendingButton>
          </div>
        </form>
      </details>
      <div style={{ marginTop: 8 }}>
        {items.map((i) => (
          <ItemRow key={i.id} r={r} data={data} item={i} />
        ))}
      </div>
      <details className="item-edit" style={{ marginTop: 8 }}>
        <summary className="btn btn-small">+ Agregar plato</summary>
        <ItemForm r={r} data={data} kind="fijo" categoryId={c.id} />
      </details>
    </section>
  );
}

function CategoryFields({ data, c }: { data: RestaurantData; c?: Category }) {
  return (
    <>
      <label className="field">
        Nombre de la categoría
        <input type="text" name="name" defaultValue={c?.name} required />
      </label>
      {data.shifts.length > 1 && (
        <label className="field">
          Turno
          <select name="shift_id" defaultValue={c?.shift_id ?? ""}>
            <option value="">Todos los turnos</option>
            {data.shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="check">
        <input type="checkbox" name="daily_options" defaultChecked={c?.daily_options} /> Sus platos son las opciones
        principales del menú del día (el precio incluye sopa, acompañantes y bebida)
      </label>
    </>
  );
}

export function CartaTab({ r, data }: { r: Restaurant; data: RestaurantData }) {
  const groups =
    data.shifts.length > 1
      ? [
          ...data.shifts.map((s) => ({ title: `Carta de ${s.name.toLowerCase()}`, cats: data.categories.filter((c) => c.shift_id === s.id) })),
          { title: "Todos los turnos", cats: data.categories.filter((c) => !c.shift_id || !data.shifts.some((s) => s.id === c.shift_id)) },
        ]
      : [{ title: "Carta", cats: data.categories }];
  const library = data.items.filter((i) => i.kind === "diario");

  return (
    <div className="stack" style={{ paddingTop: 16, paddingBottom: 48 }}>
      {groups
        .filter((g) => g.cats.length > 0)
        .map((g) => (
          <div key={g.title} className="stack">
            <h2>{g.title}</h2>
            {g.cats.map((c) => (
              <CategoryCard key={c.id} r={r} data={data} c={c} />
            ))}
          </div>
        ))}

      <details className="card item-edit">
        <summary className="btn btn-small">+ Nueva categoría</summary>
        <form action={saveCategory} className="stack" style={{ paddingTop: 12 }}>
          <input type="hidden" name="slug" value={r.slug} />
          <CategoryFields data={data} />
          <PendingButton className="btn btn-primary btn-small">Crear categoría</PendingButton>
        </form>
      </details>

      <div className="stack">
        <h2>Biblioteca del menú del día</h2>
        <p className="muted small">
          Preparaciones que rotan. Cada día se marcan las que hay en la pestaña &quot;Menú de hoy&quot;.
        </p>
        {SLOTS.map((slot) => {
          const list = library.filter((i) => i.slot === slot);
          return (
            <section key={slot} className="card">
              <h3>{SLOT_LABELS[slot]}</h3>
              {list.map((i) => (
                <ItemRow key={i.id} r={r} data={data} item={i} />
              ))}
              {list.length === 0 && <p className="muted small">Sin preparaciones todavía.</p>}
              <details className="item-edit" style={{ marginTop: 8 }}>
                <summary className="btn btn-small">+ Agregar</summary>
                <ItemForm r={r} data={data} kind="diario" slot={slot} />
              </details>
            </section>
          );
        })}
      </div>
    </div>
  );
}
