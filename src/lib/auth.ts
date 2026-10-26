import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "sesion";
const MAX_AGE = 60 * 60 * 24 * 60; // 60 días: el administrador no debe loguearse a diario

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("Falta SESSION_SECRET");
  return s ?? "solo-para-desarrollo";
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 32);
  return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}

/** role 'impl' = implementador (acceso a todo); 'admin' = administrador de un restaurante. */
export type Session = { role: "impl" } | { role: "admin"; restaurantId: string };

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function setSession(session: Session) {
  const payload = Buffer.from(JSON.stringify({ ...session, exp: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || sign(payload) !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (data.exp < Date.now()) return null;
    return data.role === "impl" ? { role: "impl" } : { role: "admin", restaurantId: data.restaurantId };
  } catch {
    return null;
  }
}

export function implPasswordOk(password: string) {
  const expected = process.env.IMPL_PASSWORD ?? "implementador";
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function requireImpl() {
  const s = await getSession();
  if (s?.role !== "impl") redirect("/impl/login");
}

/** El implementador también puede entrar al panel de cualquier restaurante. */
export async function canAdmin(restaurantId: string) {
  const s = await getSession();
  return s?.role === "impl" || (s?.role === "admin" && s.restaurantId === restaurantId);
}
