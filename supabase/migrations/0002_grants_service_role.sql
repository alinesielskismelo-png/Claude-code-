-- Projetos novos do Supabase não dão mais acesso automático às tabelas criadas pelo SQL Editor.
-- O servidor do site usa a service role; ela precisa ler e gravar. A chave pública (anon) continua sem acesso.
grant usage on schema public to service_role;
grant select, insert, update, delete on public.artifacts, public.artifact_versions, public.artifact_kv to service_role;
grant execute on function public.save_artifact_version(uuid, text, text, text) to service_role;
