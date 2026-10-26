export function formatPrice(value: number | null | undefined) {
  if (value == null) return "";
  return "$" + value.toLocaleString("es-CO", { maximumFractionDigits: 0 });
}

export function formatDateLong(date: string) {
  const text = new Date(`${date}T12:00:00Z`).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Sin 0/O ni 1/I/L: los códigos se pueden dictar o escribir a mano sin errores.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function tableCode(length = 6) {
  let code = "";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return code;
}
