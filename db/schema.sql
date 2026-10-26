-- Plataforma multi-restaurante — esquema fase 0.
-- Compatible con PostgreSQL 15+ (Supabase incluido).

create table if not exists uploads (
  id          uuid primary key default gen_random_uuid(),
  mime        text not null,
  data        bytea not null,
  created_at  timestamptz not null default now()
);

create table if not exists restaurants (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  name                text not null,
  tagline             text,
  address             text,
  phone               text,
  instagram_url       text,
  google_review_url   text,
  timezone            text not null default 'America/Bogota',
  primary_color       text not null default '#3d2b1f',
  logo_upload_id      uuid references uploads(id) on delete set null,
  bg_upload_id        uuid references uploads(id) on delete set null,
  -- 'gray' = mostrar como "Agotado hoy"; 'hide' = ocultar
  sold_out_display    text not null default 'gray' check (sold_out_display in ('gray', 'hide')),
  image_template      text not null default 'clasica' check (image_template in ('clasica', 'oscura', 'color')),
  status              text not null default 'prueba' check (status in ('prueba', 'vivo')),
  admin_password_hash text not null,
  -- Métricas del "antes" y checklist de implementación
  baseline            jsonb not null default '{}'::jsonb,
  checklist           jsonb not null default '{}'::jsonb,
  -- Cambia en cada modificación: el menú del cliente lo consulta para refrescarse
  version             bigint not null default 1,
  created_at          timestamptz not null default now()
);

-- Turnos: cada uno muestra su propia carta. Con un solo turno hay una sola carta.
create table if not exists shifts (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name          text not null,
  starts_at     time not null,
  ends_at       time not null,
  sort          int not null default 0
);

create table if not exists categories (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  shift_id      uuid references shifts(id) on delete set null,
  name          text not null,
  -- true: sus platos son las opciones principales (con precio) del menú del día
  daily_options boolean not null default false,
  sort          int not null default 0
);

-- Insumos críticos: si se agota uno, salen del menú todos los platos que lo usan.
create table if not exists supplies (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references restaurants(id) on delete cascade,
  name           text not null,
  -- null = disponible. Se reactiva solo al llegar esta hora (primer turno del día siguiente).
  sold_out_until timestamptz,
  sort           int not null default 0,
  unique (restaurant_id, name)
);

-- kind 'fijo': siempre en su categoría. kind 'diario': biblioteca del menú del día,
-- solo aparece cuando se selecciona para la fecha. slot indica su lugar en el menú del día.
create table if not exists items (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references restaurants(id) on delete cascade,
  category_id    uuid references categories(id) on delete set null,
  kind           text not null default 'fijo' check (kind in ('fijo', 'diario')),
  slot           text check (slot in ('entrada', 'principal', 'acompanante', 'bebida', 'veggie')),
  name           text not null,
  description    text,
  price          integer,
  sold_out_until timestamptz,
  active         boolean not null default true,
  sort           int not null default 0
);

create table if not exists item_supplies (
  item_id   uuid not null references items(id) on delete cascade,
  supply_id uuid not null references supplies(id) on delete cascade,
  primary key (item_id, supply_id)
);

create table if not exists daily_menus (
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  day           date not null,
  item_ids      uuid[] not null default '{}',
  note          text,
  published_at  timestamptz,
  primary key (restaurant_id, day)
);

-- Código permanente por mesa: el mismo en pantalla, papel o grabado láser.
create table if not exists tables (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  label         text not null,
  code          text not null unique,
  sort          int not null default 0
);

create index if not exists items_restaurant_idx on items(restaurant_id);
create index if not exists categories_restaurant_idx on categories(restaurant_id);
create index if not exists tables_restaurant_idx on tables(restaurant_id);
