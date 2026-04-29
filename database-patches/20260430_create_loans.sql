create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid references public.school_years(id) on delete set null,
  borrower_name text not null,
  lender_name text,
  purpose text not null,
  principal_amount numeric(12,2) not null default 0 check (principal_amount >= 0),
  interest_rate numeric(7,4) not null default 0 check (interest_rate >= 0),
  term_months integer not null default 1 check (term_months > 0),
  start_date date not null default current_date,
  due_date date,
  payment_frequency text not null default 'monthly' check (payment_frequency in ('weekly', 'monthly', 'quarterly', 'one_time')),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  status text not null default 'active' check (status in ('active', 'paid', 'overdue', 'restructured', 'written_off', 'cancelled')),
  notes text,
  recorded_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loans_school_year_idx on public.loans(school_year_id);
create index if not exists loans_status_idx on public.loans(status);
create index if not exists loans_due_date_idx on public.loans(due_date);

alter table public.loans enable row level security;

create table if not exists public.loan_payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text not null default 'cash',
  reference_number text,
  remarks text,
  recorded_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists loan_payments_loan_idx on public.loan_payments(loan_id);
create index if not exists loan_payments_payment_date_idx on public.loan_payments(payment_date);

alter table public.loan_payments enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'loans'
      and policyname = 'Allow authenticated users to manage loans'
  ) then
    create policy "Allow authenticated users to manage loans"
      on public.loans
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'loan_payments'
      and policyname = 'Allow authenticated users to manage loan payments'
  ) then
    create policy "Allow authenticated users to manage loan payments"
      on public.loan_payments
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;
