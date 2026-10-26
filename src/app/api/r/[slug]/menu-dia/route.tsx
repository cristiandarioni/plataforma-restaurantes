import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { baseUrl } from "@/lib/base-url";
import { sql } from "@/lib/db";
import { formatDateLong, formatPrice } from "@/lib/format";
import { getDailyMenu, getRestaurantBySlug, isItemOut, loadRestaurantData, type Item } from "@/lib/menu";
import { localNow } from "@/lib/time";

export const dynamic = "force-dynamic";

const W = 1080;
const H = 1920;

const fontDir = path.join(process.cwd(), "assets", "fonts");
const fontsPromise = Promise.all(
  ["Inter-Regular.otf", "Inter-SemiBold.otf", "Inter-Bold.otf", "Caladea-Bold.ttf", "Caladea-Italic.ttf"].map((f) =>
    readFile(path.join(fontDir, f)),
  ),
);

async function dataUrl(uploadId: string | null) {
  if (!uploadId) return null;
  const [u] = await sql<{ mime: string; data: Buffer }[]>`select mime, data from uploads where id = ${uploadId}`;
  if (!u || !["image/png", "image/jpeg"].includes(u.mime)) return null;
  return `data:${u.mime};base64,${Buffer.from(u.data).toString("base64")}`;
}

function rgba(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Agrupa las opciones por precio para que nunca haya dudas de cuánto cuesta cada una. */
function groupByPrice(items: Item[]) {
  const groups = new Map<number, Item[]>();
  for (const i of items) {
    const p = i.price ?? 0;
    groups.set(p, [...(groups.get(p) ?? []), i]);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]);
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await getRestaurantBySlug(slug);
  if (!r) return new Response("No encontrado", { status: 404 });

  const data = await loadRestaurantData(r.id);
  const { date } = localNow(r.timezone);
  const menu = await getDailyMenu(r.id, date);
  const selected = (menu?.item_ids ?? [])
    .map((id) => data.items.find((i) => i.id === id))
    .filter((i): i is Item => !!i && i.active);
  const bySlot = (slot: Item["slot"]) => selected.filter((i) => i.slot === slot);
  const available = (i: Item) => !isItemOut(i, data.supplies);

  const principal = bySlot("principal").filter(available);
  const optionCats = data.categories.filter((c) => c.daily_options).map((c) => c.id);
  const options = [
    ...bySlot("veggie"),
    ...data.items.filter((i) => i.kind === "fijo" && i.active && i.category_id && optionCats.includes(i.category_id)),
  ].filter(available);
  const priceGroups = groupByPrice(options);

  const [fonts, bg, logo, url] = await Promise.all([fontsPromise, dataUrl(r.bg_upload_id), dataUrl(r.logo_upload_id), baseUrl()]);

  const theme =
    r.image_template === "oscura"
      ? { bg: "#141110", overlay: "rgba(20,17,16,0.80)", text: "#f5efe6", accent: "#e3c193", muted: "#b9ab9b", line: "rgba(245,239,230,0.25)" }
      : r.image_template === "color"
        ? { bg: r.primary_color, overlay: rgba(r.primary_color, 0.88), text: "#ffffff", accent: "#ffffff", muted: "rgba(255,255,255,0.78)", line: "rgba(255,255,255,0.35)" }
        : { bg: "#f7f3ec", overlay: "rgba(250,247,242,0.88)", text: "#1f1a16", accent: r.primary_color, muted: "#6f655c", line: "rgba(31,26,22,0.22)" };

  // Si hay muchas opciones, se reduce el tamaño del texto para que todo quepa.
  const lines =
    priceGroups.reduce((n, [, items]) => n + Math.ceil(items.length / 2), 0) +
    principal.length +
    Math.ceil(bySlot("acompanante").length / 2) +
    bySlot("entrada").length +
    bySlot("bebida").length;
  const scale = Math.max(0.68, Math.min(1, 20 / Math.max(lines + 10, 1)));
  const fs = (n: number) => Math.round(n * scale);

  // Satori acomoda los fragmentos en fila: cada bloque necesita su propia columna.
  const Section = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: "flex", flexDirection: "column" }}>{children}</div>
  );
  const Label = ({ children }: { children: string }) => (
    <div
      style={{
        display: "flex",
        fontFamily: "Inter",
        fontWeight: 700,
        fontSize: fs(28),
        letterSpacing: 5,
        textTransform: "uppercase",
        color: theme.accent,
        borderBottom: `2px solid ${theme.line}`,
        paddingBottom: 10,
        marginBottom: fs(14),
        marginTop: fs(40),
      }}
    >
      {children}
    </div>
  );
  const Text = ({ children, size = 40, muted = false }: { children: React.ReactNode; size?: number; muted?: boolean }) => (
    <div style={{ display: "flex", fontFamily: "Inter", fontSize: fs(size), color: muted ? theme.muted : theme.text, lineHeight: 1.3 }}>
      {children}
    </div>
  );
  const PriceRow = ({ names, price, note }: { names: string; price: number; note?: string | null }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: fs(16), gap: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", fontFamily: "Inter", fontWeight: 600, fontSize: fs(40), color: theme.text, lineHeight: 1.3 }}>{names}</div>
        {note && <Text size={30} muted>{note}</Text>}
      </div>
      <div style={{ display: "flex", fontFamily: "Inter", fontWeight: 700, fontSize: fs(42), color: theme.text }}>{formatPrice(price)}</div>
    </div>
  );

  const included = [
    ...bySlot("entrada").map((i) => i.name.toLowerCase()),
    bySlot("acompanante").length ? "acompañantes" : null,
    ...bySlot("bebida").map((i) => i.name.toLowerCase()),
  ].filter(Boolean);

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", position: "relative", background: theme.bg }}>
        {bg && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bg} alt="" width={W} height={H} style={{ position: "absolute", top: 0, left: 0, width: W, height: H, objectFit: "cover" }} />
        )}
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, background: theme.overlay, display: "flex" }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", width: W, height: H, padding: "90px 90px 70px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" height={130} style={{ height: 130, maxWidth: 420, objectFit: "contain" }} />
            ) : (
              <div style={{ display: "flex", fontFamily: "Caladea", fontWeight: 700, fontSize: 64, color: theme.text }}>{r.name}</div>
            )}
            <div style={{ display: "flex", fontFamily: "Inter", fontSize: 30, color: theme.muted }}>
              {formatDateLong(date)}
            </div>
          </div>

          <div style={{ display: "flex", fontFamily: "Caladea", fontStyle: "italic", fontSize: fs(140), color: theme.accent, marginTop: fs(36), lineHeight: 1 }}>
            Menú del día
          </div>

          {bySlot("entrada").length > 0 && (
            <Section>
              <Label>Entrada</Label>
              {bySlot("entrada").map((i) => (
                <Text key={i.id}>{i.name}</Text>
              ))}
            </Section>
          )}

          {principal.length > 0 && (
            <Section>
              <Label>Plato del día</Label>
              {principal.map((i) => (
                <PriceRow key={i.id} names={i.name} price={i.price ?? 0} note={i.description} />
              ))}
            </Section>
          )}

          {bySlot("acompanante").length > 0 && (
            <Section>
              <Label>Acompañantes</Label>
              <Text>{bySlot("acompanante").map((i) => i.name).join(" · ")}</Text>
            </Section>
          )}

          {priceGroups.length > 0 && (
            <Section>
              <Label>Proteína del día y opciones</Label>
              {priceGroups.map(([p, items]) => (
                <PriceRow
                  key={p}
                  names={items.map((i) => i.name).join(" · ")}
                  price={p}
                  note={items.length === 1 ? items[0].description : null}
                />
              ))}
            </Section>
          )}

          {bySlot("bebida").length > 0 && (
            <Section>
              <Label>Bebida</Label>
              <Text>{bySlot("bebida").map((i) => i.name).join(" · ")}</Text>
            </Section>
          )}

          {menu?.note && (
            <div style={{ display: "flex", marginTop: fs(30) }}>
              <Text size={34}>{menu.note}</Text>
            </div>
          )}

          <div style={{ display: "flex", flex: 1 }} />

          {included.length > 0 && (
            <Text size={30} muted>
              {`Todos los platos incluyen ${included.join(", ").replace(/, ([^,]*)$/, " y $1")}.`}
            </Text>
          )}
          <div style={{ display: "flex", flexDirection: "column", borderTop: `2px solid ${theme.line}`, paddingTop: 22, marginTop: 22 }}>
            {(r.address || r.phone) && (
              <Text size={28} muted>
                {[r.address, r.phone && `Reservas y pedidos ${r.phone}`].filter(Boolean).join("  ·  ")}
              </Text>
            )}
            <Text size={28} muted>{`Menú completo: ${url.replace(/^https?:\/\//, "")}/r/${r.slug}`}</Text>
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [
        { name: "Inter", data: fonts[0], weight: 400, style: "normal" },
        { name: "Inter", data: fonts[1], weight: 600, style: "normal" },
        { name: "Inter", data: fonts[2], weight: 700, style: "normal" },
        { name: "Caladea", data: fonts[3], weight: 700, style: "normal" },
        { name: "Caladea", data: fonts[4], weight: 400, style: "italic" },
      ],
      headers: { "cache-control": "no-store" },
    },
  );
}
