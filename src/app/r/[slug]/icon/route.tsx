import { ImageResponse } from "next/og";
import { getRestaurantBySlug } from "@/lib/menu";

// Ícono provisional con la inicial del restaurante y su color.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await getRestaurantBySlug(slug);
  const size = new URL(req.url).searchParams.get("size") === "512" ? 512 : 192;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: r?.primary_color ?? "#3d2b1f",
          color: "#fff",
          fontSize: size * 0.55,
          fontWeight: 700,
        }}
      >
        {(r?.name ?? "M").trim().charAt(0).toUpperCase()}
      </div>
    ),
    { width: size, height: size },
  );
}
