"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearSession, hashPassword, implPasswordOk, requireImpl, setSession } from "@/lib/auth";
import { BASELINE_FIELDS, CHECKLIST } from "@/lib/checklist";
import { bumpVersion, sql } from "@/lib/db";
import { slugify, tableCode } from "@/lib/format";
import { getRestaurantBySlug } from "@/lib/menu";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function implLogin(_prev: string | null, f: FormData) {
  if (!implPasswordOk(str(f, "password"))) return "Clave incorrecta";
  await setSession({ role: "impl" });
  redirect("/impl");
}

export async function implLogout() {
  await clearSession();
  redirect("/impl/login");
}

async function insertTables(restaurantId: string, from: number, count: number) {
  for (let i = 0; i < count; i++) {
    // Reintenta en el caso improbable de que el código ya exista.
    for (let attempt = 0; attempt < 5; attempt++) {
      const rows = await sql`insert into tables (restaurant_id, label, code, sort)
        values (${restaurantId}, ${`Mesa ${from + i}`}, ${tableCode()}, ${from + i})
        on conflict (code) do nothing returning id`;
      if (rows.length) break;
    }
  }
}

export async function createRestaurant(_prev: string | null, f: FormData) {
  await requireImpl();
  const name = str(f, "name");
  const slug = slugify(str(f, "slug") || name);
  const password = str(f, "password");
  const tables = Math.min(Math.max(Number(str(f, "tables")) || 0, 0), 100);
  if (!name || !slug) return "Falta el nombre";
  if (password.length < 6) return "La clave del administrador debe tener al menos 6 caracteres";
  if (await getRestaurantBySlug(slug)) return `Ya existe un restaurante con la dirección /r/${slug}`;

  const [r] = await sql<{ id: string }[]>`
    insert into restaurants (slug, name, admin_password_hash) values (${slug}, ${name}, ${hashPassword(password)}) returning id`;

  const shifts =
    str(f, "shifts") === "dos"
      ? [["Almuerzo", "11:30", "16:00"], ["Cena", "18:00", "22:00"]]
      : [["Todo el día", "08:00", "22:00"]];
  const shiftIds: string[] = [];
  for (const [i, [n, a, b]] of shifts.entries()) {
    const [s] = await sql<{ id: string }[]>`insert into shifts (restaurant_id, name, starts_at, ends_at, sort)
      values (${r.id}, ${n}, ${a}, ${b}, ${i}) returning id`;
    shiftIds.push(s.id);
  }

  for (const [i, n] of ["Pollo", "Carne", "Pescado"].entries()) {
    await sql`insert into supplies (restaurant_id, name, sort) values (${r.id}, ${n}, ${i})`;
  }

  if (str(f, "daily") === "si") {
    await sql`insert into categories (restaurant_id, shift_id, name, daily_options, sort)
      values (${r.id}, ${shiftIds[0]}, 'Proteína del día y opciones', true, 0)`;
  }
  await sql`insert into categories (restaurant_id, shift_id, name, sort)
    values (${r.id}, ${shiftIds.length > 1 ? shiftIds[1] : null}, 'Platos fuertes', 1)`;

  await insertTables(r.id, 1, tables);
  redirect(`/impl/${slug}`);
}

async function restaurant(f: FormData) {
  await requireImpl();
  const r = await getRestaurantBySlug(str(f, "slug"));
  if (!r) throw new Error("Restaurante no encontrado");
  return r;
}

export async function saveChecklist(f: FormData) {
  const r = await restaurant(f);
  const checklist = Object.fromEntries(CHECKLIST.map((c) => [c.id, f.get(c.id) !== null]));
  await sql`update restaurants set checklist = ${sql.json(checklist)} where id = ${r.id}`;
  revalidatePath(`/impl/${r.slug}`);
}

export async function saveBaseline(f: FormData) {
  const r = await restaurant(f);
  const baseline = Object.fromEntries(BASELINE_FIELDS.map((b) => [b.id, str(f, b.id)]));
  await sql`update restaurants set baseline = ${sql.json(baseline)} where id = ${r.id}`;
  revalidatePath(`/impl/${r.slug}`);
}

export async function setStatus(f: FormData) {
  const r = await restaurant(f);
  const status = str(f, "status") === "vivo" ? "vivo" : "prueba";
  await sql`update restaurants set status = ${status} where id = ${r.id}`;
  await bumpVersion(r.id);
  revalidatePath(`/impl/${r.slug}`);
  revalidatePath(`/r/${r.slug}`);
}

export async function addTables(f: FormData) {
  const r = await restaurant(f);
  const count = Math.min(Math.max(Number(str(f, "count")) || 1, 1), 50);
  const [{ max }] = await sql<{ max: number }[]>`select coalesce(max(sort), 0)::int as max from tables where restaurant_id = ${r.id}`;
  await insertTables(r.id, max + 1, count);
  revalidatePath(`/impl/${r.slug}`);
}

export async function renameTable(f: FormData) {
  const r = await restaurant(f);
  const label = str(f, "label");
  if (!label) return;
  await sql`update tables set label = ${label} where id = ${str(f, "id")} and restaurant_id = ${r.id}`;
  revalidatePath(`/impl/${r.slug}`);
}

export async function deleteTable(f: FormData) {
  const r = await restaurant(f);
  await sql`delete from tables where id = ${str(f, "id")} and restaurant_id = ${r.id}`;
  revalidatePath(`/impl/${r.slug}`);
}
