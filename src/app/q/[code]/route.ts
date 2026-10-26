import { NextResponse } from "next/server";
import { getRestaurantByTableCode } from "@/lib/menu";

// El QR impreso apunta aquí y nunca cambia; el destino sí puede cambiar.
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const found = await getRestaurantByTableCode(code);
  if (!found) return new NextResponse("Código no encontrado", { status: 404 });
  const url = new URL(`/r/${found.slug}`, req.url);
  url.searchParams.set("mesa", found.label);
  return NextResponse.redirect(url, 307);
}
