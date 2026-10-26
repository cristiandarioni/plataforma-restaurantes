import Link from "next/link";

export default function Home() {
  return (
    <main className="wrap stack" style={{ paddingTop: 48 }}>
      <h1>Menú digital para restaurantes</h1>
      <p className="muted">QR permanente por mesa, agotados por insumo y menú del día en un minuto.</p>
      <div className="row">
        <Link className="btn btn-primary" href="/impl">Panel del implementador</Link>
      </div>
    </main>
  );
}
