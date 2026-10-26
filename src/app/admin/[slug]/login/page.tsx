import { notFound } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getRestaurantBySlug } from "@/lib/menu";
import { login } from "../actions";

export default async function AdminLogin({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await getRestaurantBySlug(slug);
  if (!r) notFound();
  return (
    <main className="wrap" style={{ maxWidth: 400, paddingTop: 64 }}>
      <div className="card stack">
        <h1>{r.name}</h1>
        <p className="muted">Panel del administrador</p>
        <LoginForm action={login} hidden={{ slug: r.slug }} />
      </div>
    </main>
  );
}
