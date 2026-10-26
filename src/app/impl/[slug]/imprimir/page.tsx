import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { requireImpl } from "@/lib/auth";
import { baseUrl } from "@/lib/base-url";
import { getRestaurantBySlug, loadRestaurantData } from "@/lib/menu";
import { qrSvg, tableUrl } from "@/lib/qr";

export const dynamic = "force-dynamic";

/** Hoja para imprimir QR provisionales en papel (mismos códigos que los definitivos). */
export default async function PrintSheet({ params }: { params: Promise<{ slug: string }> }) {
  await requireImpl();
  const { slug } = await params;
  const r = await getRestaurantBySlug(slug);
  if (!r) notFound();
  const { tables } = await loadRestaurantData(r.id);
  const base = await baseUrl();
  const qrs = await Promise.all(tables.map((t) => qrSvg(tableUrl(base, t.code))));

  return (
    <main className="wrap">
      <div className="no-print row" style={{ marginBottom: 16 }}>
        <Link className="btn" href={`/impl/${r.slug}`}>
          ← Volver
        </Link>
        <PrintButton />
      </div>
      <div className="qr-sheet">
        {tables.map((t, i) => (
          <div key={t.id} className="card">
            <strong>{r.name}</strong>
            <div className="small muted">Escanea para ver el menú</div>
            <div className="qr" style={{ margin: "8px auto", maxWidth: 220 }} dangerouslySetInnerHTML={{ __html: qrs[i] }} />
            <strong>{t.label}</strong>
          </div>
        ))}
      </div>
    </main>
  );
}
