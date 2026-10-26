# Plataforma de menú digital para restaurantes — Fase 0

Menú PWA con QR permanente por mesa, agotados por insumo y menú del día publicado en un minuto.
Multi-restaurante desde el inicio: cada restaurante es un registro más, sin desarrollo a la medida.

## Qué incluye

| Para quién | Dónde | Qué hace |
|---|---|---|
| Cliente | `/q/CODIGO` → `/r/restaurante` | Escanea el QR de su mesa y ve la carta del turno vigente. Los agotados se actualizan solos en segundos. Botones de Google e Instagram. |
| Administrador | `/admin/restaurante` | **Agotados**: un toque en "Pollo" saca todos los platos con pollo. Se reactiva solo al día siguiente. **Menú de hoy**: precargado con el de ayer; marcar, publicar y compartir la imagen. **Carta** y **Ajustes**. |
| Implementador | `/impl` | Crear restaurante en un minuto, mesas con QR, QR en pantalla para pruebas, hoja para imprimir, lista de implementación, números del "antes" y paso de prueba a en vivo. |

## Reglas implementadas

- **QR permanente**: apunta a `/q/CODIGO`; el código no cambia aunque cambie el soporte (pantalla, papel, grabado).
- **Insumos críticos**: un plato puede tener 0, 1 o varios. Si se agota uno, el plato sale del menú.
- **Agotados**: por defecto se muestran como "Agotado hoy"; cada restaurante puede elegir ocultarlos.
- **Reactivación**: manual en cualquier momento o automática al inicio del primer turno del día siguiente
  (se guarda `sold_out_until`; no hace falta ninguna tarea programada).
- **Turnos**: uno o dos, cada uno con su carta según la hora (zona horaria del restaurante).
- **Menú del día armado**: entrada, acompañantes y bebida incluidos; el precio lo define la opción principal.
- **Imagen del menú del día** (1080×1920, historia de Instagram / estado de WhatsApp): precios agrupados para que no haya
  ambigüedad, 3 plantillas (clásica, oscura, color) con logo y foto de fondo del restaurante.

## Ejecutar en local

Requisitos: Node 20+ y PostgreSQL 15+.

```bash
npm install
cp .env.example .env.local      # completar SESSION_SECRET (openssl rand -hex 32)
npm run db:seed                 # crea tablas y el restaurante piloto Donde Raíz
npm run build && npm start      # http://localhost:3000
```

- Implementador: `/impl` · clave `IMPL_PASSWORD` (por defecto `implementador`)
- Administrador del piloto: `/admin/donde-raiz` · clave `raiz2026`
- `npm run db:setup` crea o actualiza las tablas sin borrar datos. `db:seed` **reinicia** el restaurante piloto.

## Producción

1. Crear un proyecto en Supabase (o cualquier PostgreSQL) y ejecutar `npm run db:setup` con su `DATABASE_URL`
   y `DATABASE_SSL=true`.
2. Desplegar en Vercel con las variables de `.env.example`.
3. **`PUBLIC_BASE_URL` debe ser el dominio definitivo antes de imprimir cualquier QR**: es lo que lo hace permanente.

## Pendiente de la fase 0

- Formulario previo a la visita (un enlace para que el restaurante suba menú, logo y enlaces).
- Extracción automática del menú desde PDF o foto, y sugerencia automática de insumos por nombre del plato.
