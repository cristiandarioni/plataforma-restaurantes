import Link from "next/link";
import { notFound } from "next/navigation";
import { PendingButton } from "@/components/PendingButton";
import { requireImpl } from "@/lib/auth";
import { baseUrl } from "@/lib/base-url";
import { BASELINE_FIELDS, CHECKLIST } from "@/lib/checklist";
import { getRestaurantBySlug, loadRestaurantData } from "@/lib/menu";
import { qrSvg, tableUrl } from "@/lib/qr";
import { addTables, deleteTable, renameTable, saveBaseline, saveChecklist, setStatus } from "../actions";

export const dynamic = "force-dynamic";

export default async function ImplRestaurant({ params }: { params: Promise<{ slug: string }> }) {
  await requireImpl();
  const { slug } = await params;
  const r = await getRestaurantBySlug(slug);
  if (!r) notFound();
  const data = await loadRestaurantData(r.id);
  const base = await baseUrl();
  const qrs = await Promise.all(data.tables.map((t) => qrSvg(tableUrl(base, t.code))));

  // Pistas automáticas para cada punto de la lista
  const priced = data.items.filter((i) => i.price != null);
  const hints: Record<string, string> = {
    menu: `${data.items.length} platos y preparaciones cargados`,
    insumos: `${priced.filter((i) => i.supply_ids.length).length} de ${priced.length} platos con precio tienen insumos`,
    qr: `${data.tables.length} mesas con código`,
    enlaces: [r.instagram_url ? "Instagram ✓" : "Falta Instagram", r.google_review_url ? "Google ✓" : "Falta Google"].join(" · "),
    metricas: r.baseline?.fecha ? `Medido el ${r.baseline.fecha}` : "Sin medir",
  };
  const done = CHECKLIST.filter((c) => r.checklist?.[c.id]).length;

  return (
    <main className="wrap-wide stack" style={{ paddingBottom: 48 }}>
      <Link href="/impl" className="small muted">
        ← Restaurantes
      </Link>
      <div className="spread">
        <div>
          <h1>{r.name}</h1>
          <div className="muted small">
            {base}/r/{r.slug}
          </div>
        </div>
        <div className="row">
          <Link className="btn" href={`/admin/${r.slug}`} target="_blank">
            Panel del administrador
          </Link>
          <Link className="btn" href={`/r/${r.slug}`} target="_blank">
            Ver menú
          </Link>
        </div>
      </div>

      <section className="card">
        <div className="spread">
          <h2>Lista de implementación</h2>
          <span className={`pill ${done === CHECKLIST.length ? "pill-ok" : ""}`}>
            {done}/{CHECKLIST.length}
          </span>
        </div>
        <form action={saveChecklist} className="stack">
          <input type="hidden" name="slug" value={r.slug} />
          {CHECKLIST.map((c) => (
            <label key={c.id} className="check" style={{ display: "flex", alignItems: "flex-start" }}>
              <input type="checkbox" name={c.id} defaultChecked={!!r.checklist?.[c.id]} style={{ marginTop: 3 }} />
              <span>
                {c.label}
                {hints[c.id] && <span className="muted small"> — {hints[c.id]}</span>}
              </span>
            </label>
          ))}
          <PendingButton className="btn btn-primary btn-small" pendingText="Guardando…">
            Guardar lista
          </PendingButton>
        </form>
      </section>

      <section className="card">
        <h2>Estado</h2>
        <p className="muted small">
          En modo prueba el menú funciona completo pero muestra un aviso. Pásalo a &quot;En vivo&quot; cuando se instalen los QR.
        </p>
        <form action={setStatus} className="row">
          <input type="hidden" name="slug" value={r.slug} />
          <input type="hidden" name="status" value={r.status === "vivo" ? "prueba" : "vivo"} />
          <span className={`pill ${r.status === "vivo" ? "pill-ok" : ""}`}>{r.status === "vivo" ? "En vivo" : "Modo prueba"}</span>
          <PendingButton className="btn btn-small">{r.status === "vivo" ? "Volver a modo prueba" : "Pasar a en vivo"}</PendingButton>
        </form>
      </section>

      <section className="card">
        <div className="spread">
          <h2>Mesas y códigos QR</h2>
          <div className="row">
            {data.tables.length > 0 && (
              <>
                <Link className="btn btn-small btn-primary" href={`/impl/${r.slug}/qr`}>
                  Mostrar QR en pantalla
                </Link>
                <Link className="btn btn-small" href={`/impl/${r.slug}/imprimir`}>
                  Imprimir en papel
                </Link>
              </>
            )}
          </div>
        </div>
        <p className="muted small">
          Cada código es permanente: el mismo sirve en pantalla, en papel o grabado. Eliminar una mesa invalida su QR.
        </p>
        <div className="grid2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
          {data.tables.map((t, i) => (
            <div key={t.id} className="card" style={{ padding: 12 }}>
              <div className="qr" dangerouslySetInnerHTML={{ __html: qrs[i] }} />
              <form action={renameTable} className="stack" style={{ marginTop: 8 }}>
                <input type="hidden" name="slug" value={r.slug} />
                <input type="hidden" name="id" value={t.id} />
                <input type="text" name="label" defaultValue={t.label} aria-label="Nombre de la mesa" />
                <div className="spread">
                  <code className="small">{t.code}</code>
                  <span className="row" style={{ gap: 4 }}>
                    <PendingButton className="btn btn-small">Guardar</PendingButton>
                    <PendingButton
                      className="btn btn-small btn-danger"
                      formAction={deleteTable}
                      confirm={`¿Eliminar ${t.label}? Su QR impreso dejará de funcionar.`}
                    >
                      ✕
                    </PendingButton>
                  </span>
                </div>
              </form>
            </div>
          ))}
        </div>
        <form action={addTables} className="row" style={{ marginTop: 12 }}>
          <input type="hidden" name="slug" value={r.slug} />
          <input type="number" name="count" min={1} max={50} defaultValue={1} style={{ width: 90 }} aria-label="Cantidad" />
          <PendingButton className="btn btn-small">Agregar mesas</PendingButton>
        </form>
      </section>

      <section className="card">
        <h2>Números del &quot;antes&quot;</h2>
        <p className="muted small">La base del caso de éxito. Se miden el día de la implementación, antes de que los clientes usen el QR.</p>
        <form action={saveBaseline} className="stack">
          <input type="hidden" name="slug" value={r.slug} />
          <div className="grid2">
            {BASELINE_FIELDS.map((b) => (
              <label key={b.id} className="field">
                {b.label}
                <input type={b.type} name={b.id} defaultValue={r.baseline?.[b.id] ?? ""} step={b.type === "number" ? 1 : undefined} />
              </label>
            ))}
          </div>
          <PendingButton className="btn btn-primary btn-small" pendingText="Guardando…">
            Guardar
          </PendingButton>
        </form>
      </section>
    </main>
  );
}
