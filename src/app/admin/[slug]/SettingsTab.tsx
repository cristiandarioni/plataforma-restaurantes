import { PendingButton } from "@/components/PendingButton";
import type { Restaurant, RestaurantData } from "@/lib/menu";
import {
  addSupply,
  changePassword,
  deleteShift,
  deleteSupply,
  removeImage,
  saveSettings,
  saveShift,
  uploadImage,
} from "./actions";

function Hidden({ slug }: { slug: string }) {
  return <input type="hidden" name="slug" value={slug} />;
}

export function SettingsTab({ r, data }: { r: Restaurant; data: RestaurantData }) {
  return (
    <div className="stack" style={{ paddingTop: 16, paddingBottom: 48 }}>
      <section className="card">
        <h2>Restaurante</h2>
        <form action={saveSettings} className="stack">
          <Hidden slug={r.slug} />
          <div className="grid2">
            <label className="field">
              Nombre
              <input type="text" name="name" defaultValue={r.name} required />
            </label>
            <label className="field">
              Frase corta
              <input type="text" name="tagline" defaultValue={r.tagline ?? ""} />
            </label>
            <label className="field">
              Dirección
              <input type="text" name="address" defaultValue={r.address ?? ""} />
            </label>
            <label className="field">
              Teléfono de reservas y pedidos
              <input type="tel" name="phone" defaultValue={r.phone ?? ""} />
            </label>
            <label className="field">
              Enlace de Instagram
              <input type="url" name="instagram_url" defaultValue={r.instagram_url ?? ""} placeholder="https://instagram.com/…" />
            </label>
            <label className="field">
              Enlace para calificar en Google
              <input type="url" name="google_review_url" defaultValue={r.google_review_url ?? ""} placeholder="https://g.page/r/…/review" />
            </label>
            <label className="field">
              Color principal
              <input type="color" name="primary_color" defaultValue={r.primary_color} style={{ width: "100%", height: 44, marginTop: 4 }} />
            </label>
            <label className="field">
              Platos agotados
              <select name="sold_out_display" defaultValue={r.sold_out_display}>
                <option value="gray">Mostrar como &quot;Agotado hoy&quot;</option>
                <option value="hide">Ocultarlos del menú</option>
              </select>
            </label>
            <label className="field">
              Plantilla de la imagen del menú del día
              <select name="image_template" defaultValue={r.image_template}>
                <option value="clasica">Clásica (sobre la foto, fondo claro)</option>
                <option value="oscura">Oscura</option>
                <option value="color">Color del restaurante</option>
              </select>
            </label>
          </div>
          <div className="row">
            <PendingButton className="btn btn-primary" pendingText="Guardando…">Guardar</PendingButton>
            <a className="btn" href={`/api/r/${r.slug}/menu-dia`} target="_blank">Ver imagen de hoy</a>
          </div>
        </form>
      </section>

      <section className="card">
        <h2>Logo y foto de fondo</h2>
        <p className="muted small">PNG o JPG de menos de 4 MB. La foto de fondo se usa en la imagen del menú del día.</p>
        <div className="grid2">
          {(["logo", "bg"] as const).map((target) => {
            const id = target === "logo" ? r.logo_upload_id : r.bg_upload_id;
            return (
              <div key={target} className="stack">
                <strong>{target === "logo" ? "Logo" : "Foto de fondo"}</strong>
                {id && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/u/${id}`} alt="" style={{ maxWidth: "100%", maxHeight: 140, objectFit: "contain", background: "#eee", borderRadius: 8 }} />
                )}
                <form action={uploadImage} className="stack">
                  <Hidden slug={r.slug} />
                  <input type="hidden" name="target" value={target} />
                  <input type="file" name="file" accept="image/png,image/jpeg" required />
                  <div className="row">
                    <PendingButton className="btn btn-small" pendingText="Subiendo…">Subir</PendingButton>
                    {id && (
                      <PendingButton className="btn btn-small btn-danger" formAction={removeImage}>
                        Quitar
                      </PendingButton>
                    )}
                  </div>
                </form>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>Turnos</h2>
        <p className="muted small">
          Uno o dos turnos. Cada turno muestra su propia carta según la hora. Los agotados se reactivan solos al
          empezar el primer turno del día.
        </p>
        {data.shifts.map((s) => (
          <form key={s.id} action={saveShift} className="row list-row" style={{ alignItems: "end" }}>
            <Hidden slug={r.slug} />
            <input type="hidden" name="id" value={s.id} />
            <label className="field" style={{ flex: 2 }}>
              Nombre
              <input type="text" name="name" defaultValue={s.name} required />
            </label>
            <label className="field" style={{ flex: 1 }}>
              Abre
              <input type="time" name="starts_at" defaultValue={s.starts_at} required />
            </label>
            <label className="field" style={{ flex: 1 }}>
              Cierra
              <input type="time" name="ends_at" defaultValue={s.ends_at} required />
            </label>
            <PendingButton className="btn btn-small">Guardar</PendingButton>
            <PendingButton className="btn btn-small btn-danger" formAction={deleteShift} confirm={`¿Eliminar el turno "${s.name}"?`}>
              Eliminar
            </PendingButton>
          </form>
        ))}
        {data.shifts.length < 2 && (
          <form action={saveShift} className="row" style={{ alignItems: "end", marginTop: 12 }}>
            <Hidden slug={r.slug} />
            <label className="field" style={{ flex: 2 }}>
              Nuevo turno
              <input type="text" name="name" placeholder={data.shifts.length ? "Cena" : "Almuerzo"} required />
            </label>
            <label className="field" style={{ flex: 1 }}>
              Abre
              <input type="time" name="starts_at" required />
            </label>
            <label className="field" style={{ flex: 1 }}>
              Cierra
              <input type="time" name="ends_at" required />
            </label>
            <PendingButton className="btn btn-small btn-primary">Agregar</PendingButton>
          </form>
        )}
      </section>

      <section className="card">
        <h2>Insumos que se pueden agotar</h2>
        {data.supplies.map((s) => (
          <form key={s.id} action={deleteSupply} className="list-row">
            <Hidden slug={r.slug} />
            <input type="hidden" name="id" value={s.id} />
            <span>{s.name}</span>
            <PendingButton className="btn btn-small btn-danger" confirm={`¿Eliminar "${s.name}"? Los platos dejarán de depender de él.`}>
              Eliminar
            </PendingButton>
          </form>
        ))}
        <form action={addSupply} className="row" style={{ marginTop: 12 }}>
          <Hidden slug={r.slug} />
          <input type="text" name="name" placeholder="Ej: Camarón" required style={{ flex: 1 }} />
          <PendingButton className="btn btn-primary">Agregar</PendingButton>
        </form>
      </section>

      <section className="card">
        <h2>Clave del administrador</h2>
        <form action={changePassword} className="row">
          <Hidden slug={r.slug} />
          <input type="password" name="password" minLength={6} placeholder="Nueva clave (mínimo 6)" required style={{ flex: 1 }} autoComplete="new-password" />
          <PendingButton className="btn">Cambiar</PendingButton>
        </form>
      </section>
    </div>
  );
}
