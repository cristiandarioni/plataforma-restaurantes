import { NextResponse } from "next/server";
import { getRestaurantBySlug, loadRestaurantData, menuSignature } from "@/lib/menu";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await getRestaurantBySlug(slug);
  if (!r) return NextResponse.json({ error: "no encontrado" }, { status: 404 });
  const data = await loadRestaurantData(r.id);
  return NextResponse.json({ signature: menuSignature(r, data) }, { headers: { "cache-control": "no-store" } });
}
