-- J10 (ACC-2): the admin adds and removes invited emails from the app, no code change. Reviewers cannot touch the list.
drop policy if exists allowlist_admin_all on public.allowlist;
create policy allowlist_admin_all on public.allowlist for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
