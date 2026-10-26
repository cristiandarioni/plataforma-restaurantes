"use client";

import { useFormStatus } from "react-dom";

/** Botón de formulario que se bloquea mientras se guarda, para evitar dobles toques. */
export function PendingButton({
  children,
  pendingText,
  className = "btn",
  confirm,
  formAction,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  confirm?: string;
  formAction?: (f: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={className}
      disabled={pending}
      aria-busy={pending}
      formAction={formAction}
      formNoValidate={!!formAction}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
