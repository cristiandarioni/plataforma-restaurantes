import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveMenu } from "@/components/LiveMenu";
import { formatPrice } from "@/lib/format";
import {
  SLOT_LABELS,
  buildPublicMenu,
  getRestaurantBySlug,
  loadRestaurantData,
  menuSignature,
  type MenuItemView,
} from "@/lib/menu";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ mesa?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const r = await getRestaurantBySlug(slug);
  if (!r) return {};
  return {
    title: `${r.name} · Menú`,
    manifest: `/r/${r.slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: r.name },
    icons: { apple: `/r/${r.slug}/icon?size=192` },
  };
}

function Dish({ item }: { item: MenuItemView }) {
  return (
    <div className={`dish${item.soldOut ? " out" : ""}`}>
      <div>
        <div className="dname">{item.name}</div>
        {item.description && <div className="ddesc">{item.description}</div>}
        {item.soldOut && <span className="pill pill-bad">Agotado hoy</span>}
      </div>
      {item.price != null && <div className="dprice">{formatPrice(item.price)}</div>}
    </div>
  );
}

export default async function MenuPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { mesa } = await searchParams;
  const r = await getRestaurantBySlug(slug);
  if (!r) notFound();
  const data = await loadRestaurantData(r.id);
  const menu = await buildPublicMenu(r, data);
  const signature = menuSignature(r, data);

  return (
    <div style={{ ["--accent" as string]: r.primary_color }}>
      <LiveMenu slug={r.slug} signature={signature} />
      <header className="menu-header">
        {r.logo_upload_id && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="logo" src={`/api/u/${r.logo_upload_id}`} alt={r.name} />
        )}
        <h1>{r.name}</h1>
        {r.tagline && <div className="tagline">{r.tagline}</div>}
        <div className="meta">
          {menu.shift && <>Carta de {menu.shift.name.toLowerCase()}</>}
          {mesa && <> · {mesa}</>}
        </div>
      </header>

      <main className="wrap">
        {r.status === "prueba" && <p className="banner">Modo prueba: este menú todavía no está publicado para clientes.</p>}
        {!menu.open && menu.shift && (
          <p className="banner">
            Ahora estamos cerrados. Abrimos a las {menu.shift.starts_at} con esta carta.
          </p>
        )}

        {menu.daily && (
          <section className="menu-section">
            <h2>Menú del día</h2>
            {menu.daily.included.length > 0 ? (
              <dl className="included">
                {menu.daily.included.map((g) => (
                  <div key={g.slot}>
                    <dt>{SLOT_LABELS[g.slot]}</dt>
                    <dd>{g.items.map((i) => i.name).join(", ")}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="muted small">El menú del día se publica en breve.</p>
            )}
            {menu.daily.note && <p className="small muted">{menu.daily.note}</p>}
            <p className="small muted" style={{ marginTop: 16 }}>
              Elige tu plato principal. El precio incluye todo el almuerzo.
            </p>
            <div>
              {menu.daily.options.map((i) => (
                <Dish key={i.id} item={i} />
              ))}
            </div>
          </section>
        )}

        {menu.sections.map((s) => (
          <section key={s.category.id} className="menu-section">
            <h2>{s.category.name}</h2>
            {s.items.map((i) => (
              <Dish key={i.id} item={i} />
            ))}
          </section>
        ))}

        <footer className="menu-footer">
          {r.google_review_url && (
            <a className="btn btn-primary" href={r.google_review_url} target="_blank" rel="noopener">
              Califícanos en Google
            </a>
          )}
          {r.instagram_url && (
            <a className="btn" href={r.instagram_url} target="_blank" rel="noopener">
              Síguenos en Instagram
            </a>
          )}
          {r.address && <p className="small muted">{r.address}</p>}
          {r.phone && (
            <p className="small muted">
              Reservas y pedidos: <a href={`tel:${r.phone}`}>{r.phone}</a>
            </p>
          )}
        </footer>
      </main>
    </div>
  );
}
