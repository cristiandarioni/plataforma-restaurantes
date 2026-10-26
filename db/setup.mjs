// Crea el esquema y, con --seed, carga el restaurante piloto (Donde Raíz).
// Uso: node db/setup.mjs [--seed]
import { readFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL ?? "postgres://menu:menu@localhost:5432/menu", {
  ssl: process.env.DATABASE_SSL === "true" ? "require" : false,
  onnotice: () => {},
});

await sql.unsafe(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
console.log("Esquema listo.");

if (process.argv.includes("--seed")) await seed();
await sql.end();

function hash(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}

function code() {
  const a = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  return [...randomBytes(6)].map((b) => a[b % a.length]).join("");
}

async function seed() {
  const slug = "donde-raiz";
  await sql`delete from restaurants where slug = ${slug}`;
  const [r] = await sql`
    insert into restaurants (slug, name, tagline, address, phone, primary_color, admin_password_hash)
    values (${slug}, 'Donde Raíz', 'Cocina de raíz', 'Cra 5 # 5-70, Centro, Barichara', '3175885346',
            '#3d2b1f', ${hash("raiz2026")})
    returning id`;

  const [almuerzo] = await sql`insert into shifts (restaurant_id, name, starts_at, ends_at, sort)
    values (${r.id}, 'Almuerzo', '11:30', '16:00', 0) returning id`;
  const [cena] = await sql`insert into shifts (restaurant_id, name, starts_at, ends_at, sort)
    values (${r.id}, 'Cena', '18:00', '22:00', 1) returning id`;

  const supplies = {};
  for (const [i, name] of ["Pollo", "Carne", "Pescado", "Cerdo", "Hígado"].entries()) {
    const [s] = await sql`insert into supplies (restaurant_id, name, sort) values (${r.id}, ${name}, ${i}) returning id`;
    supplies[name] = s.id;
  }

  const [opciones] = await sql`insert into categories (restaurant_id, shift_id, name, daily_options, sort)
    values (${r.id}, ${almuerzo.id}, 'Proteína del día y opciones', true, 0) returning id`;
  const [noche] = await sql`insert into categories (restaurant_id, shift_id, name, sort)
    values (${r.id}, ${cena.id}, 'Carta de la noche (ejemplo: reemplazar)', 0) returning id`;
  const [bebidas] = await sql`insert into categories (restaurant_id, shift_id, name, sort)
    values (${r.id}, ${cena.id}, 'Bebidas (ejemplo: reemplazar)', 1) returning id`;

  let sort = 0;
  async function item({ category = null, kind = "fijo", slot = null, name, description = null, price = null, uses = [] }) {
    const [it] = await sql`insert into items (restaurant_id, category_id, kind, slot, name, description, price, sort)
      values (${r.id}, ${category}, ${kind}, ${slot}, ${name}, ${description}, ${price}, ${sort++}) returning id`;
    for (const u of uses) await sql`insert into item_supplies (item_id, supply_id) values (${it.id}, ${supplies[u]})`;
    return it.id;
  }

  // Opciones principales fijas del almuerzo (precio = almuerzo completo)
  await item({ category: opciones.id, name: "Pechuga", price: 22000, uses: ["Pollo"] });
  await item({ category: opciones.id, name: "Res", price: 22000, uses: ["Carne"] });
  await item({ category: opciones.id, name: "Cerdo", price: 22000, uses: ["Cerdo"] });
  await item({ category: opciones.id, name: "Hígado", price: 22000, uses: ["Hígado"] });
  await item({ category: opciones.id, name: "Chuleta de cerdo ahumado", price: 27000, uses: ["Cerdo"] });
  await item({ category: opciones.id, name: "Trucha al ajillo", price: 30000, uses: ["Pescado"] });
  await item({ category: opciones.id, name: "Churrasquito de chatas", price: 30000, uses: ["Carne"] });
  await item({ category: opciones.id, name: "Punta de anca con chimichurri", price: 30000, uses: ["Carne"] });
  await item({ category: opciones.id, name: "Salmón en reducción de vino y frutos rojos", price: 36000, uses: ["Pescado"] });

  // Biblioteca del menú del día
  const today = [
    await item({ kind: "diario", slot: "entrada", name: "Sopa de fideos" }),
    await item({ kind: "diario", slot: "principal", name: "Pollo al curry", price: 20000, uses: ["Pollo"] }),
    await item({ kind: "diario", slot: "acompanante", name: "Arroz verde" }),
    await item({ kind: "diario", slot: "acompanante", name: "Cazuelita de lentejas" }),
    await item({ kind: "diario", slot: "acompanante", name: "Ensalada de pepino agridulce" }),
    await item({ kind: "diario", slot: "acompanante", name: "Papitas criollas" }),
    await item({ kind: "diario", slot: "bebida", name: "Jugo natural de temporada" }),
    await item({ kind: "diario", slot: "veggie", name: "Opción veggie del día", description: "Pregunta por la preparación de hoy", price: 25000 }),
  ];

  // Carta de la noche: solo marcadores para probar el cambio de turno
  await item({ category: noche.id, name: "Plato de ejemplo 1", description: "Reemplazar con la carta real de la noche", price: 35000, uses: ["Carne"] });
  await item({ category: noche.id, name: "Plato de ejemplo 2", description: "Reemplazar con la carta real de la noche", price: 32000, uses: ["Pescado"] });
  await item({ category: bebidas.id, name: "Bebida de ejemplo", price: 8000 });

  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  await sql`insert into daily_menus (restaurant_id, day, item_ids, published_at)
    values (${r.id}, ${day}, ${today}, now())`;

  for (let i = 1; i <= 8; i++) {
    await sql`insert into tables (restaurant_id, label, code, sort) values (${r.id}, ${"Mesa " + i}, ${code()}, ${i})`;
  }
  console.log(`Restaurante piloto cargado: /r/${slug} · clave del administrador: raiz2026`);
}
