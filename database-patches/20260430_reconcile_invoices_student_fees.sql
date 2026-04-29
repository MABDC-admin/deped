-- Reconcile invoice records with the student ledger source of truth.
-- Student ledger totals live in student_fees; invoices should mirror those
-- totals through invoices.student_fee_id so payment collection stays aligned.

begin;

with matched as (
  select
    i.id as invoice_id,
    sf.id as student_fee_id,
    sf.student_id,
    sf.school_year_id,
    sf.total_fees,
    sf.total_discount,
    sf.total_paid,
    sf.balance
  from public.invoices i
  join public.student_fees sf
    on sf.id = i.student_fee_id
    or (
      i.student_fee_id is null
      and i.student_id = sf.student_id
      and i.school_year_id = sf.school_year_id
    )
  where coalesce(i.status, 'unpaid') <> 'void'
),
ranked as (
  select *, row_number() over (partition by invoice_id order by student_fee_id) as rn
  from matched
)
update public.invoices i
set
  student_fee_id = r.student_fee_id,
  student_id = r.student_id,
  school_year_id = r.school_year_id,
  total_amount = coalesce(r.total_fees, 0),
  discount_amount = coalesce(r.total_discount, 0),
  net_amount = greatest(coalesce(r.total_fees, 0) - coalesce(r.total_discount, 0), 0),
  amount_paid = coalesce(r.total_paid, 0),
  balance = greatest(coalesce(r.balance, 0), 0),
  status = case
    when greatest(coalesce(r.balance, 0), 0) <= 0 then 'paid'
    when coalesce(r.total_paid, 0) > 0 then 'partial'
    else 'unpaid'
  end,
  updated_at = now()
from ranked r
where i.id = r.invoice_id
  and r.rn = 1;

insert into public.invoices (
  invoice_number,
  student_id,
  student_fee_id,
  school_year_id,
  total_amount,
  discount_amount,
  net_amount,
  amount_paid,
  balance,
  due_date,
  status,
  notes,
  generated_by,
  created_at,
  updated_at
)
select
  'INV-' || to_char(coalesce(sf.created_at, now()), 'YYYYMMDD') || '-' || upper(left(sf.id::text, 8)),
  sf.student_id,
  sf.id,
  sf.school_year_id,
  coalesce(sf.total_fees, 0),
  coalesce(sf.total_discount, 0),
  greatest(coalesce(sf.total_fees, 0) - coalesce(sf.total_discount, 0), 0),
  coalesce(sf.total_paid, 0),
  greatest(coalesce(sf.balance, 0), 0),
  (coalesce(sf.created_at, now())::date + interval '30 days')::date,
  case
    when greatest(coalesce(sf.balance, 0), 0) <= 0 then 'paid'
    when coalesce(sf.total_paid, 0) > 0 then 'partial'
    else 'unpaid'
  end,
  'Generated from student ledger',
  null,
  coalesce(sf.created_at, now()),
  now()
from public.student_fees sf
where not exists (
  select 1
  from public.invoices i
  where coalesce(i.status, 'unpaid') <> 'void'
    and (
      i.student_fee_id = sf.id
      or (
        i.student_fee_id is null
        and i.student_id = sf.student_id
        and i.school_year_id = sf.school_year_id
      )
    )
)
on conflict (invoice_number) do nothing;

commit;
