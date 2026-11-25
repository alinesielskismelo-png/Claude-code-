-- Configurações do site (ex.: a conexão com o Google, guardada cifrada pelo servidor).
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
grant select, insert, update, delete on public.app_settings to service_role;
