// Utilidades de hora local del restaurante, sin dependencias externas.

function wallClock(tz: string, at: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function offsetMs(tz: string, at: Date) {
  const w = wallClock(tz, at);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Fecha (YYYY-MM-DD) y minuto del día en la zona horaria del restaurante. */
export function localNow(tz: string, at = new Date()) {
  const w = wallClock(tz, at);
  const date = `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
  return { date, minutes: w.hour * 60 + w.minute };
}

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Convierte una fecha y hora locales del restaurante a un instante UTC. */
export function zonedToUtc(date: string, time: string, tz: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - offsetMs(tz, new Date(guess));
  return new Date(guess - offsetMs(tz, new Date(first)));
}

export function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export type ShiftLike = { id: string; name: string; starts_at: string; ends_at: string };

/**
 * Turno vigente. Si el restaurante está cerrado, devuelve el próximo turno
 * (hoy o mañana) con open=false para mostrar su carta y la hora de apertura.
 */
export function currentShift<T extends ShiftLike>(shifts: T[], tz: string, at = new Date()) {
  if (shifts.length === 0) return { shift: null, open: true };
  const { minutes } = localNow(tz, at);
  const sorted = [...shifts].sort((a, b) => toMinutes(a.starts_at) - toMinutes(b.starts_at));
  for (const s of sorted) {
    const start = toMinutes(s.starts_at);
    const end = toMinutes(s.ends_at);
    const inside = end > start ? minutes >= start && minutes < end : minutes >= start || minutes < end;
    if (inside) return { shift: s, open: true };
  }
  const next = sorted.find((s) => toMinutes(s.starts_at) > minutes) ?? sorted[0];
  return { shift: next, open: false };
}

/** Momento en que se reactivan solos los agotados: el primer turno del día siguiente. */
export function nextResetAt(shifts: ShiftLike[], tz: string, at = new Date()) {
  const { date } = localNow(tz, at);
  const first = [...shifts].sort((a, b) => toMinutes(a.starts_at) - toMinutes(b.starts_at))[0];
  return zonedToUtc(addDays(date, 1), first ? first.starts_at.slice(0, 5) : "05:00", tz);
}
