// Tipos y constantes del menú que también usa el navegador (sin acceso a la base de datos).

export type Restaurant = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  address: string | null;
  phone: string | null;
  instagram_url: string | null;
  google_review_url: string | null;
  timezone: string;
  primary_color: string;
  logo_upload_id: string | null;
  bg_upload_id: string | null;
  sold_out_display: "gray" | "hide";
  image_template: "clasica" | "oscura" | "color";
  status: "prueba" | "vivo";
  admin_password_hash: string;
  baseline: Record<string, string>;
  checklist: Record<string, boolean>;
  version: string;
};

export type Shift = { id: string; name: string; starts_at: string; ends_at: string; sort: number };
export type Category = { id: string; shift_id: string | null; name: string; daily_options: boolean; sort: number };
export type Supply = { id: string; name: string; sold_out_until: Date | null; sort: number };
export type Slot = "entrada" | "principal" | "acompanante" | "bebida" | "veggie";
export type Item = {
  id: string;
  category_id: string | null;
  kind: "fijo" | "diario";
  slot: Slot | null;
  name: string;
  description: string | null;
  price: number | null;
  sold_out_until: Date | null;
  active: boolean;
  sort: number;
  supply_ids: string[];
};
export type Table = { id: string; label: string; code: string; sort: number };

export const SLOT_LABELS: Record<Slot, string> = {
  entrada: "Entrada",
  principal: "Plato del día",
  acompanante: "Acompañantes",
  bebida: "Bebida",
  veggie: "Opción veggie",
};

/** Lo que va incluido en el almuerzo armado (sin precio propio). */
export const INCLUDED_SLOTS: Slot[] = ["entrada", "acompanante", "bebida"];

