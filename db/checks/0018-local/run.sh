#!/bin/bash
# Throwaway test of migration 0018 and its rollback on a local Postgres. Never touches Supabase.
set -u
export LC_ALL=C LANG=C
D=$(cd "$(dirname "$0")" && pwd)
S="${PGTEST_DIR:-$D/pg}"; REPO=$(cd "$D/../../.." && pwd) # data dir: set PGTEST_DIR to keep it outside the repo
rm -rf "$S"; mkdir -p "$S"
initdb -D "$S/data" -U postgres -A trust --no-locale -E UTF8 > "$S/initdb.log" 2>&1 || { cat "$S/initdb.log"; exit 1; }
pg_ctl -D "$S/data" -o "-p 55432 -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" -l "$S/log" -w start >/dev/null
trap 'pg_ctl -D "$S/data" -m fast stop >/dev/null' EXIT
psql -h 127.0.0.1 -p 55432 -U postgres -X -q -c "create database t" || { cat "$S/log"; exit 1; }
q() { psql -h 127.0.0.1 -p 55432 -U postgres -d t -X -q -A -F ' | ' "$@"; }

# One role check: claims and role are set for this one transaction only.
check() { # $1 label, $2 email or "" (signed out), $3 schema of is_allowed/is_admin
  local role=authenticated claims
  if [ -z "$2" ]; then role=anon; claims='{"role":"anon"}'; else claims="{\"role\":\"authenticated\",\"email\":\"$2\"}"; fi
  q -t -c "begin;
select set_config('request.jwt.claims', '$claims', true);
set local role $role;
select '$1' as who,
 'companies=' || (select count(*) from public.companies),
 'links=' || (select string_agg(status, ',' order by id) from public.relationships),
 'evals=' || (select count(*) from public.eval_results),
 'hood_tests=' || case when has_function_privilege('public.hood_tests()', 'execute') then (select count(*) from public.hood_tests())::text else 'no EXECUTE' end,
 'hood_cost=' || case when has_function_privilege('public.hood_agents()', 'execute') then coalesce((select max(cost_usd) from public.hood_agents())::text, 'hidden') else 'no EXECUTE' end;
rollback;" 2>&1 | grep -v '^$' | grep -v '^set_config\|^{'
}
anon() { q -t -c "begin; set local role anon; select 'signed out', 'companies=' || (select count(*) from public.companies), 'links=' || (select count(*) from public.relationships), 'evals=' || (select count(*) from public.eval_results), 'EXECUTE on any of the five=' || (select bool_or(has_function_privilege(p.oid, 'execute')) from pg_proc p where p.proname in ('is_admin','is_allowed','hood_tests','hood_agents','hood_source_share')); rollback;" 2>&1 | grep -v '^$'; }
roles() { check admin admin@test.invalid; check reviewer reviewer@test.invalid; check "not invited" nobody@test.invalid; anon; }
state() {
  q -t -c "select n.nspname || '.' || p.proname, 'config=' || coalesce(array_to_string(p.proconfig, ';'), 'NONE'), 'acl=' || coalesce(p.proacl::text, 'default')
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.proname in ('is_admin','is_allowed','hood_tests','hood_agents','hood_source_share') order by 1;"
  q -t -c "select 'policy ' || policyname || ': ' || qual from pg_policies where policyname in ('companies_read','relationships_read') order by 1;"
}

q -v ON_ERROR_STOP=1 -f "$D/setup.sql" >/dev/null && echo "== A. Before 0018 (copy of live setup)"; roles

echo; echo "== B. 0018 applied verbatim"
q -1 -v ON_ERROR_STOP=1 -f "$REPO/db/migrations/0018_definer_function_grants.sql" >/dev/null && echo "applied OK"
state; roles
q -t -c "select 'rpc path gone: public.is_allowed exists? ' || exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('is_allowed','is_admin'))"
q -t -c "select 'anon USAGE on private? ' || has_schema_privilege('anon','private','usage') || '; authenticated? ' || has_schema_privilege('authenticated','private','usage')"

echo; echo "== C. USAGE on private taken away on purpose: stored policies keep working; only a query that names private.* fails. Then restored"
q -c "revoke usage on schema private from authenticated"
q -t -c "select 'authenticated USAGE on private now: ' || has_schema_privilege('authenticated','private','usage')"
check reviewer reviewer@test.invalid
echo "-- a query that names private.is_allowed() itself, as a signed-in user:"
q -t -c "begin; select set_config('request.jwt.claims', '{\"email\":\"reviewer@test.invalid\"}', true); set local role authenticated; select private.is_allowed(); rollback;" 2>&1 | grep -iv '^$\|^{'
q -c "grant usage on schema private to authenticated"; check "reviewer (USAGE back)" reviewer@test.invalid

echo; echo "== D. Rollback applied verbatim"
q -v ON_ERROR_STOP=1 -f "$REPO/db/migrations/0018_definer_function_grants.rollback.sql" >/dev/null && echo "rolled back OK"
state; roles
q -t -c "select 'private schema exists? ' || exists(select 1 from pg_namespace where nspname='private')"
