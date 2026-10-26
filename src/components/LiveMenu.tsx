"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** Mantiene el menú al día: si el administrador marca un agotado, el cliente lo ve en segundos. */
export function LiveMenu({ slug, signature }: { slug: string; signature: string }) {
  const router = useRouter();
  const current = useRef(signature);
  current.current = signature;

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    let stopped = false;
    async function check() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/r/${slug}/signature`, { cache: "no-store" });
        const { signature: latest } = await res.json();
        if (!stopped && latest && latest !== current.current) router.refresh();
      } catch {
        // Sin conexión: se mantiene lo que ya está en pantalla.
      }
    }
    const timer = setInterval(check, 8000);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [slug, router]);

  return null;
}
