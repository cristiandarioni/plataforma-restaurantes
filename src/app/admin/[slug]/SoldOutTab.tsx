import { PendingButton } from "@/components/PendingButton";
import { isItemOut, isSupplyOut, SLOT_LABELS, type Restaurant, type RestaurantData } from "@/lib/menu";
import { toggleItem, toggleSupply } from "./actions";

function untilLabel(until: Date, tz: string) {
  return new Date(until).toLocaleString("es-CO", {
    timeZone: tz,
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SoldOutTab({ r, data }: { r: Restaurant; data: RestaurantData }) {
  const { supplies, items, categories } = data;
  const activeItems = items.filter((i) => i.active && i.price != null);

  return (
    <div className="stack" style={{ paddingTop: 16 }}>
      <div>
        <h2>¿Qué se acabó?</h2>
        <p className="muted small">
          Toca un insumo para agotarlo: todos los platos que lo usan salen del menú al instante. Se reactiva solo
          al empezar el primer turno del día siguiente, o antes si lo tocas de nuevo.
        </p>
      </div>

      <div className="grid2">
        {supplies.map((s) => {
          const out = isSupplyOut(s);
          const affected = activeItems.filter((i) => i.supply_ids.includes(s.id)).length;
          return (
            <form key={s.id} action={toggleSupply}>
              <input type="hidden" name="slug" value={r.slug} />
              <input type="hidden" name="id" value={s.id} />
              <PendingButton className={`supply${out ? " out" : ""}`} pendingText="Guardando…">
                <span>
                  <span className="name">{s.name}</span>
                  <br />
                  <span className="small muted">
                    {affected} {affected === 1 ? "plato" : "platos"}
                  </span>
                </span>
                <span className="state">
                  {out ? (
                    <>
                      AGOTADO
                      <br />
                      <span className="small" style={{ fontWeight: 400 }}>
                        vuelve {untilLabel(s.sold_out_until!, r.timezone)}
                      </span>
                    </>
                  ) : (
                    "Disponible"
                  )}
                </span>
              </PendingButton>
            </form>
          );
        })}
      </div>
      {supplies.length === 0 && <p className="muted">Aún no hay insumos. Agrégalos en Ajustes.</p>}

      <details className="card">
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Agotar un plato puntual</summary>
        <p className="muted small">Para cuando se acaba algo que no es un insumo crítico (por ejemplo, una salsa).</p>
        {[
          ...categories.map((c) => ({
            title: c.name,
            list: activeItems.filter((i) => i.kind === "fijo" && i.category_id === c.id),
          })),
          {
            title: "Menú del día",
            list: activeItems.filter((i) => i.kind === "diario"),
          },
        ]
          .filter((g) => g.list.length > 0)
          .map((g) => (
            <div key={g.title} style={{ marginTop: 16 }}>
              <h3 className="small muted" style={{ textTransform: "uppercase", letterSpacing: ".08em" }}>
                {g.title}
              </h3>
              {g.list.map((i) => {
                const bySupply = supplies.filter((s) => i.supply_ids.includes(s.id) && isSupplyOut(s));
                const out = isItemOut(i, supplies);
                return (
                  <div key={i.id} className="list-row">
                    <div>
                      {i.name}
                      {i.slot && <span className="muted small"> · {SLOT_LABELS[i.slot]}</span>}{" "}
                      {out && (
                        <span className="pill pill-bad">
                          {bySupply.length ? `Sin ${bySupply.map((s) => s.name.toLowerCase()).join(", ")}` : "Agotado"}
                        </span>
                      )}
                    </div>
                    {bySupply.length === 0 && (
                      <form action={toggleItem}>
                        <input type="hidden" name="slug" value={r.slug} />
                        <input type="hidden" name="id" value={i.id} />
                        <PendingButton className="btn btn-small" pendingText="…">
                          {out ? "Reactivar" : "Agotar"}
                        </PendingButton>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
      </details>
    </div>
  );
}
