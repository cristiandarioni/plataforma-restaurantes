"use client";

import { useActionState } from "react";

export function LoginForm({
  action,
  hidden,
}: {
  action: (prev: string | null, f: FormData) => Promise<string | null>;
  hidden?: Record<string, string>;
}) {
  const [error, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="stack">
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className="field">
        Clave
        <input type="password" name="password" autoFocus required autoComplete="current-password" />
      </label>
      {error && <p className="pill pill-bad">{error}</p>}
      <button className="btn btn-primary" disabled={pending} style={{ width: "100%" }}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
