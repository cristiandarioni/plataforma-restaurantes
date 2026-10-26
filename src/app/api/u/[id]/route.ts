import { sql } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("No encontrado", { status: 404 });
  const [row] = await sql<{ mime: string; data: Buffer }[]>`select mime, data from uploads where id = ${id}`;
  if (!row) return new Response("No encontrado", { status: 404 });
  // Cada archivo nuevo tiene un id nuevo, así que se puede cachear para siempre.
  return new Response(new Uint8Array(row.data), {
    headers: { "content-type": row.mime, "cache-control": "public, max-age=31536000, immutable" },
  });
}
