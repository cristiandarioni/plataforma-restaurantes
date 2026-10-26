import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAdmin } from "@/lib/auth";
import { getDailyMenu, getPreviousDailyMenu, getRestaurantBySlug, loadRestaurantData } from "@/lib/menu";
import { localNow } from "@/lib/time";
import { CartaTab } from "./CartaTab";
import { DailyEditor } from "./DailyEditor";
import { SettingsTab } from "./SettingsTab";
import { SoldOutTab } from "./SoldOutTab";
import { logout } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Panel del administrador" };

const TABS = [
  { id: "agotados", label: "Agotados" },
  { id: "hoy", label: "Menú de hoy" },
  { id: "carta", label: "Carta" },
  { id: "ajustes", label: "Ajustes" },
] as const;

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab = "agotados" } = await searchParams;
  const r = await getRestaurantBySlug(slug);
  if (!r) notFound();
  if (!(await canAdmin(r.id))) redirect(`/admin/${slug}/login`);
  const data = await loadRestaurantData(r.id);

  let daily = null;
  if (tab === "hoy") {
    const { date } = localNow(r.timezone);
    const today = await getDailyMenu(r.id, date);
    const previous = today ? null : await getPreviousDailyMenu(r.id, date);
    daily = {
      date,
      published: !!today?.published_at,
      fromYesterday: !today && !!previous,
      itemIds: today?.item_ids ?? previous?.item_ids ?? [],
      note: today?.note ?? previous?.note ?? "",
    };
  }

  return (
    <div style={{ ["--accent" as string]: r.primary_color }}>
      <div className="topbar">
        <div className="wrap-wide">
          <strong>{r.name}</strong>
          <div className="row">
            <Link className="btn btn-small" href={`/r/${r.slug}`} target="_blank">
              Ver menú
            </Link>
            <form action={logout}>
              <input type="hidden" name="slug" value={r.slug} />
              <button className="btn btn-small">Salir</button>
            </form>
          </div>
        </div>
      </div>
      <nav className="tabs">
        <div className="wrap-wide" style={{ display: "flex", padding: "0 8px" }}>
          {TABS.map((t) => (
            <Link key={t.id} href={`/admin/${r.slug}?tab=${t.id}`} className={tab === t.id ? "on" : ""}>
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="wrap-wide">
        {tab === "agotados" && <SoldOutTab r={r} data={data} />}
        {tab === "hoy" && daily && <DailyEditor slug={r.slug} data={data} daily={daily} />}
        {tab === "carta" && <CartaTab r={r} data={data} />}
        {tab === "ajustes" && <SettingsTab r={r} data={data} />}
      </main>
    </div>
  );
}
