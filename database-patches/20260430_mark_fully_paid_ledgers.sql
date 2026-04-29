-- Mark accounts and payments as fully paid when completed payments cover the net assessment.

begin;

update public.student_fees
set
  status = case
    when coalesce(total_fees, 0) - coalesce(total_discount, 0) - coalesce(total_paid, 0) <= 0.005 then 'paid'
    when coalesce(total_paid, 0) > 0 then 'partial'
    else 'unpaid'
  end,
  updated_at = now()
where status is distinct from case
    when coalesce(total_fees, 0) - coalesce(total_discount, 0) - coalesce(total_paid, 0) <= 0.005 then 'paid'
    when coalesce(total_paid, 0) > 0 then 'partial'
    else 'unpaid'
  end;

update public.invoices i
set
  total_amount = coalesce(sf.total_fees, 0),
  discount_amount = coalesce(sf.total_discount, 0),
  net_amount = greatest(coalesce(sf.total_fees, 0) - coalesce(sf.total_discount, 0), 0),
  amount_paid = coalesce(sf.total_paid, 0),
  balance = greatest(coalesce(sf.balance, 0), 0),
  status = case
    when coalesce(sf.balance, 0) <= 0.005 and coalesce(sf.total_fees, 0) - coalesce(sf.total_discount, 0) > 0 then 'paid'
    when coalesce(sf.total_paid, 0) > 0 then 'partial'
    else 'unpaid'
  end,
  updated_at = now()
from public.student_fees sf
where coalesce(i.status, 'unpaid') <> 'void'
  and (
    i.student_fee_id = sf.id
    or (
      i.student_fee_id is null
      and i.student_id = sf.student_id
      and i.school_year_id = sf.school_year_id
    )
  );

update public.payments p
set status = 'paid'
from public.student_fees sf
where p.student_fee_id = sf.id
  and coalesce(p.is_refunded, false) = false
  and coalesce(p.status, 'completed') in ('completed', 'paid')
  and coalesce(sf.balance, 0) <= 0.005
  and coalesce(sf.total_fees, 0) - coalesce(sf.total_discount, 0) > 0
  and p.status is distinct from 'paid';

commit;
