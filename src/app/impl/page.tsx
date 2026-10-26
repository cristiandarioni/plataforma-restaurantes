import Link from "next/link";
import { requireImpl } from "@/lib/auth";
import { CHECKLIST } from "@/lib/checklist";
import { sql } from "@/lib/db";
import type { Restaurant } from "@/lib/menu";
import { implLogout } from "./actions";
import { CreateRestaurantForm } from "./CreateRestaurantForm";

export const dynamic = "force-dynamic";

export default async function ImplHome() {
  await requireImpl();
  const restaurants = await sql<Restaurant[]>`select * from restaurants order by created_at desc`;
  return (
    <main className="wrap-wide stack">
      <div className="spread">
        <h1>Restaurantes</h1>
        <form action={implLogout}>
          <button className="btn btn-small">Salir</button>
        </form>
      </div>
      {restaurants.map((r) => {
        const done = CHECKLIST.filter((c) => r.checklist?.[c.id]).length;
        return (
          <Link key={r.id} href={`/impl/${r.slug}`} className="card spread" style={{ textDecoration: "none" }}>
            <div>
              <strong>{r.name}</strong>
              <div className="muted small">/r/{r.slug}</div>
            </div>
            <div className="row">
              <span className="pill">
                {done}/{CHECKLIST.length} lista
              </span>
              <span className={`pill ${r.status === "vivo" ? "pill-ok" : ""}`}>{r.status === "vivo" ? "En vivo" : "Prueba"}</span>
            </div>
          </Link>
        );
      })}
      <section className="card">
        <h2>Nuevo restaurante</h2>
        <p className="muted small">Crea la base en un minuto: turnos, insumos (pollo, carne, pescado) y mesas con su código QR.</p>
        <CreateRestaurantForm />
      </section>
    </main>
  );
}
