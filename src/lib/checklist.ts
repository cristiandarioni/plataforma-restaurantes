export const CHECKLIST = [
  { id: "menu", label: "Menú completo (fijo y del día) cargado y aprobado por el dueño" },
  { id: "insumos", label: "Insumos críticos asociados a cada plato" },
  { id: "qr", label: "Cada mesa probada escaneando su QR desde al menos 2 celulares" },
  { id: "capacitacion", label: "El administrador, él mismo: agotó y reactivó un insumo, cambió un precio y publicó el menú del día" },
  { id: "enlaces", label: "Enlaces de Instagram y Google funcionando" },
  { id: "metricas", label: "Números del \"antes\" registrados" },
] as const;

export const BASELINE_FIELDS = [
  { id: "fecha", label: "Fecha de la medición", type: "date" },
  { id: "resenas_google", label: "Reseñas en Google (cantidad)", type: "number" },
  { id: "calificacion_google", label: "Calificación en Google (ej. 4.5)", type: "text" },
  { id: "seguidores_instagram", label: "Seguidores en Instagram", type: "number" },
  { id: "ticket_promedio", label: "Ticket promedio (opcional)", type: "text" },
  { id: "notas", label: "Notas", type: "text" },
] as const;
