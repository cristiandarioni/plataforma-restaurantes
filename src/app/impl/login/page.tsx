import { LoginForm } from "@/components/LoginForm";
import { implLogin } from "../actions";

export default function ImplLogin() {
  return (
    <main className="wrap" style={{ maxWidth: 400, paddingTop: 64 }}>
      <div className="card stack">
        <h1>Implementador</h1>
        <p className="muted">Acceso del equipo de implementación</p>
        <LoginForm action={implLogin} />
      </div>
    </main>
  );
}
