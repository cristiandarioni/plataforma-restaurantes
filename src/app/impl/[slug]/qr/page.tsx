import Link from "next/link";
import { notFound } from "next/navigation";
import { requireImpl } from "@/lib/auth";
import { baseUrl } from "@/lib/base-url";
import { getRestaurantBySlug, loadRestaurantData } from "@/lib/menu";
import { qrSvg, tableUrl } from "@/lib/qr";

export const dynamic = "force-dynamic";

/** QR provisional en pantalla: se le muestra el celular a otro celular para probar cada mesa. */
export default async function QrPresenter({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ i?: string }>;
}) {
  await requireImpl();
  const { slug } = await params;
  const { i } = await searchParams;
  const r = await getRestaurantBySlug(slug);
  if (!r) notFound();
  const { tables } = await loadRestaurantData(r.id);
  if (tables.length === 0) notFound();
  const index = Math.min(Math.max(Number(i) || 0, 0), tables.length - 1);
  const t = tables[index];
  const svg = await qrSvg(tableUrl(await baseUrl(), t.code));

  return (
    <main className="qr-present">
      <div className="muted">{r.name}</div>
      <h1 style={{ fontSize: "2.5rem", margin: 0 }}>{t.label}</h1>
      <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
      <code>{t.code}</code>
      <div className="row" style={{ justifyContent: "center" }}>
        <Link className="btn" href={`?i=${(index - 1 + tables.length) % tables.length}`} aria-label="Mesa anterior">
          ← Anterior
        </Link>
        <span className="muted">
          {index + 1} / {tables.length}
        </span>
        <Link className="btn btn-primary" href={`?i=${(index + 1) % tables.length}`} aria-label="Mesa siguiente">
          Siguiente →
        </Link>
      </div>
      <Link className="small muted" href={`/impl/${r.slug}`}>
        Volver
      </Link>
    </main>
  );
}
