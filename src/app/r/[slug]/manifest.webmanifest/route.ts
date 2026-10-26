import { NextResponse } from "next/server";
import { getRestaurantBySlug } from "@/lib/menu";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await getRestaurantBySlug(slug);
  if (!r) return new NextResponse("No encontrado", { status: 404 });
  return NextResponse.json(
    {
      name: r.name,
      short_name: r.name,
      start_url: `/r/${r.slug}`,
      scope: `/r/${r.slug}`,
      display: "standalone",
      background_color: "#f7f4ef",
      theme_color: r.primary_color,
      icons: [
        { src: `/r/${r.slug}/icon?size=192`, sizes: "192x192", type: "image/png" },
        { src: `/r/${r.slug}/icon?size=512`, sizes: "512x512", type: "image/png" },
      ],
    },
    { headers: { "content-type": "application/manifest+json" } },
  );
}
