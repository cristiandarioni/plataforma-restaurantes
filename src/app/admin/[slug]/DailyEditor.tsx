"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDateLong, formatPrice } from "@/lib/format";
import type { RestaurantData } from "@/lib/menu";
import { SLOT_LABELS, type Slot } from "@/lib/menu-shared";
import { addLibraryItem, saveDailyMenu } from "./actions";

const ORDER: Slot[] = ["entrada", "principal", "acompanante", "bebida", "veggie"];
const PRICED: Slot[] = ["principal", "veggie"];

type Daily = { date: string; published: boolean; fromYesterday: boolean; itemIds: string[]; note: string };

export function DailyEditor({ slug, data, daily }: { slug: string; data: RestaurantData; daily: Daily }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(daily.itemIds));
  const [note, setNote] = useState(daily.note);
  const [saving, startSaving] = useTransition();
  const [published, setPublished] = useState(daily.published);
  const [image, setImage] = useState<{ url: string; file: File } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const library = data.items.filter((i) => i.kind === "diario" && i.active);
  const fixedOptions = data.items.filter(
    (i) => i.kind === "fijo" && i.active && data.categories.find((c) => c.id === i.category_id)?.daily_options,
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setImage(null);
  }

  function publish() {
    setError(null);
    startSaving(async () => {
      try {
        // El orden de la biblioteca define el orden en el menú y en la imagen.
        const ids = library.filter((i) => selected.has(i.id)).map((i) => i.id);
        await saveDailyMenu(slug, ids, note, true);
        setPublished(true);
        // La imagen se descarga ya, para que el botón de compartir funcione con un solo toque.
        const res = await fetch(`/api/r/${slug}/menu-dia?t=${Date.now()}`);
        if (!res.ok) throw new Error("No se pudo generar la imagen");
        const blob = await res.blob();
        const file = new File([blob], `menu-${daily.date}.png`, { type: "image/png" });
        setImage({ url: URL.createObjectURL(blob), file });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al publicar");
      }
    });
  }

  async function share() {
    if (!image) return;
    if (navigator.canShare?.({ files: [image.file] })) {
      try {
        await navigator.share({ files: [image.file], title: "Menú del día" });
      } catch {
        // El usuario cerró el menú de compartir.
      }
    } else {
      const a = document.createElement("a");
      a.href = image.url;
      a.download = image.file.name;
      a.click();
    }
  }

  return (
    <div className="stack" style={{ paddingTop: 16, paddingBottom: 120 }}>
      <div>
        <h2>{formatDateLong(daily.date)}</h2>
        {daily.fromYesterday && !published && (
          <p className="banner">Precargado con el último menú publicado. Cambia solo lo que es distinto hoy.</p>
        )}
        {published && <span className="pill pill-ok">Publicado</span>}
      </div>

      {ORDER.map((slot) => (
        <section key={slot} className="card">
          <div className="spread">
            <h3>{SLOT_LABELS[slot]}</h3>
            <span className="muted small">{PRICED.includes(slot) ? "con precio" : "incluido"}</span>
          </div>
          <div className="chips" style={{ marginTop: 8 }}>
            {library
              .filter((i) => i.slot === slot)
              .map((i) => (
                <label key={i.id} className="chip">
                  <input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} />
                  <span>
                    {i.name}
                    {i.price != null && ` · ${formatPrice(i.price)}`}
                  </span>
                </label>
              ))}
          </div>
          <AddToLibrary
            slug={slug}
            slot={slot}
            supplies={data.supplies}
            onAdded={(id) => {
              setSelected((prev) => new Set(prev).add(id));
              setImage(null);
              router.refresh();
            }}
          />
        </section>
      ))}

      <section className="card">
        <h3>Opciones fijas</h3>
        <p className="muted small">
          Siempre aparecen en el menú del día: {fixedOptions.map((i) => i.name).join(", ") || "ninguna"}. Se editan
          en la pestaña Carta.
        </p>
        <label className="field" style={{ marginTop: 12 }}>
          Nota del día (opcional)
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: hoy hay postre de la casa" />
        </label>
      </section>

      {image && (
        <section className="card stack" style={{ textAlign: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt="Imagen del menú del día" style={{ width: "100%", maxWidth: 320, borderRadius: 12, margin: "0 auto", display: "block" }} />
          <button className="btn btn-primary" onClick={share} style={{ width: "100%" }}>
            Compartir en WhatsApp / Instagram
          </button>
        </section>
      )}

      {error && <p className="pill pill-bad">{error}</p>}

      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: 12, background: "var(--surface)", borderTop: "1px solid var(--line)" }}>
        <div className="wrap-wide" style={{ padding: 0 }}>
          <button className="btn btn-primary" onClick={publish} disabled={saving} style={{ width: "100%" }}>
            {saving ? "Publicando…" : published ? "Volver a publicar y generar imagen" : "Publicar menú de hoy"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddToLibrary({
  slug,
  slot,
  supplies,
  onAdded,
}: {
  slug: string;
  slot: Slot;
  supplies: RestaurantData["supplies"];
  onAdded: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [uses, setUses] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const priced = PRICED.includes(slot);

  if (!open)
    return (
      <button className="btn btn-small" style={{ marginTop: 10 }} onClick={() => setOpen(true)}>
        + Nueva
      </button>
    );

  return (
    <div className="stack" style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
      <input type="text" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      {priced && (
        <input type="text" inputMode="numeric" placeholder="Precio del almuerzo completo, ej: 20000" value={price} onChange={(e) => setPrice(e.target.value)} />
      )}
      {priced && supplies.length > 0 && (
        <div>
          <div className="muted small">¿Qué insumos usa? (si se agota uno, sale del menú)</div>
          <div className="row">
            {supplies.map((s) => (
              <label key={s.id} className="check">
                <input
                  type="checkbox"
                  checked={uses.includes(s.id)}
                  onChange={() => setUses((u) => (u.includes(s.id) ? u.filter((x) => x !== s.id) : [...u, s.id]))}
                />
                {s.name}
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="row">
        <button
          className="btn btn-primary btn-small"
          disabled={pending || !name.trim()}
          onClick={() =>
            start(async () => {
              const digits = price.replace(/[^\d]/g, "");
              const id = await addLibraryItem(slug, slot, name, digits ? Number(digits) : null, uses);
              setName("");
              setPrice("");
              setUses([]);
              setOpen(false);
              onAdded(id);
            })
          }
        >
          {pending ? "Guardando…" : "Guardar y marcar para hoy"}
        </button>
        <button className="btn btn-small" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
