-- Plataforma de artefatos: biblioteca, versões e dados dos artefatos.
-- Rode no SQL Editor do Supabase (ou com `supabase db push`).
-- O app acessa o banco SÓ pelo servidor, com a service role key. RLS fica ligado e sem
-- políticas, então a chave pública (anon) não lê nem escreve nada.

create extension if not exists pgcrypto;

create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  tags text[] not null default '{}',
  kind text not null default 'html' check (kind in ('html', 'react')),
  current_version_id uuid,
  version_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artifact_versions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  number integer not null,
  code text not null,
  message text not null default '',
  source text not null default 'manual' check (source in ('import', 'manual', 'ai', 'restore')),
  size integer not null,
  created_at timestamptz not null default now(),
  unique (artifact_id, number)
);

create index if not exists artifact_versions_artifact_idx on public.artifact_versions (artifact_id, number desc);
create index if not exists artifacts_updated_idx on public.artifacts (updated_at desc);
create index if not exists artifacts_tags_idx on public.artifacts using gin (tags);

-- Dados que cada artefato salva (localStorage, window.storage, db), separados por artefato.
create table if not exists public.artifact_kv (
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (artifact_id, key)
);

alter table public.artifacts enable row level security;
alter table public.artifact_versions enable row level security;
alter table public.artifact_kv enable row level security;

-- Cria uma versão nova e a torna a atual, numa única transação.
create or replace function public.save_artifact_version(
  p_artifact_id uuid,
  p_code text,
  p_message text,
  p_source text
) returns public.artifact_versions
language plpgsql
as $$
declare
  v_number integer;
  v_row public.artifact_versions;
begin
  update public.artifacts
     set version_count = version_count + 1
   where id = p_artifact_id
  returning version_count into v_number;

  if v_number is null then
    return null;
  end if;

  insert into public.artifact_versions (artifact_id, number, code, message, source, size)
  values (p_artifact_id, v_number, p_code, coalesce(p_message, ''), coalesce(p_source, 'manual'),
          octet_length(p_code))
  returning * into v_row;

  update public.artifacts
     set current_version_id = v_row.id, updated_at = now()
   where id = p_artifact_id;

  return v_row;
end;
$$;

revoke all on function public.save_artifact_version(uuid, text, text, text) from public, anon, authenticated;
