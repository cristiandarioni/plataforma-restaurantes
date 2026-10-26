import postgres from "postgres";

// Una sola conexión compartida entre recargas en desarrollo.
const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

export const sql =
  globalForDb.sql ??
  postgres(process.env.DATABASE_URL ?? "postgres://menu:menu@localhost:5432/menu", {
    max: 10,
    // Supabase y la mayoría de Postgres gestionados exigen SSL; en local no.
    ssl: process.env.DATABASE_SSL === "true" ? "require" : false,
  });

if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;

/** Marca que el restaurante cambió: los menús abiertos en los celulares se refrescan. */
export async function bumpVersion(restaurantId: string) {
  await sql`update restaurants set version = version + 1 where id = ${restaurantId}`;
}
