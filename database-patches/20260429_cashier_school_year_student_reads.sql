-- Allows cashier views to scope students by school year without falling back to
-- global student lists. Run as the table owner/supabase_admin.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'enrollments'
      and policyname = 'enr_select_cashier'
  ) then
    create policy enr_select_cashier
      on public.enrollments
      for select
      to authenticated
      using (get_user_role() = 'cashier');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sections'
      and policyname = 'sec_select_cashier'
  ) then
    create policy sec_select_cashier
      on public.sections
      for select
      to authenticated
      using (get_user_role() = 'cashier');
  end if;
end $$;
