-- Push linked invoice amount/discount edits back into student_fees, then
-- refresh invoice paid/balance/status from the generated ledger balance.

begin;

update public.student_fees sf
set
  total_fees = coalesce(i.total_amount, 0),
  total_discount = coalesce(i.discount_amount, 0),
  status = case
    when greatest(coalesce(i.total_amount, 0) - coalesce(i.discount_amount, 0) - coalesce(sf.total_paid, 0), 0) <= 0 then 'paid'
    when coalesce(sf.total_paid, 0) > 0 then 'partial'
    else 'unpaid'
  end,
  updated_at = now()
from public.invoices i
where i.student_fee_id = sf.id
  and coalesce(i.status, 'unpaid') <> 'void'
  and (
    coalesce(i.total_amount, 0) <> coalesce(sf.total_fees, 0)
    or coalesce(i.discount_amount, 0) <> coalesce(sf.total_discount, 0)
  );

update public.invoices i
set
  total_amount = coalesce(sf.total_fees, 0),
  discount_amount = coalesce(sf.total_discount, 0),
  net_amount = greatest(coalesce(sf.total_fees, 0) - coalesce(sf.total_discount, 0), 0),
  amount_paid = coalesce(sf.total_paid, 0),
  balance = greatest(coalesce(sf.balance, 0), 0),
  status = case
    when greatest(coalesce(sf.balance, 0), 0) <= 0 then 'paid'
    when coalesce(sf.total_paid, 0) > 0 then 'partial'
    else 'unpaid'
  end,
  updated_at = now()
from public.student_fees sf
where i.student_fee_id = sf.id
  and coalesce(i.status, 'unpaid') <> 'void';

commit;
