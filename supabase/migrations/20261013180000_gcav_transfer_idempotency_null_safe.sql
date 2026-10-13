-- Treat missing or malformed idempotency metadata as a mismatch.
-- SQL comparisons with NULL do not evaluate to true, so ordinary <> checks
-- could otherwise accept a previously used request id with incomplete metadata.
create or replace function public.gca_transfer_money(
  p_recipient uuid,
  p_amount numeric,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender uuid := auth.uid();
  sender_balance numeric(12,2);
  recipient_balance numeric(12,2);
  prior_amount numeric(12,2);
  prior_recipient uuid;
begin
  if sender is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;
  if p_recipient is null or p_recipient = sender then
    raise exception 'Choose another player' using errcode = '22023';
  end if;
  if p_request_id is null or p_amount is null or p_amount <= 0 or p_amount > 10000
     or round(p_amount, 2) <> p_amount then
    raise exception 'Invalid transfer amount or request id' using errcode = '22023';
  end if;

  perform 1 from public.gca_wallets
  where user_id in (sender, p_recipient)
  order by user_id
  for update;

  select balance into sender_balance from public.gca_wallets where user_id = sender;
  select balance into recipient_balance from public.gca_wallets where user_id = p_recipient;
  if sender_balance is null or recipient_balance is null then
    raise exception 'Player wallet not found' using errcode = 'P0002';
  end if;

  select amount, nullif(metadata ->> 'recipient', '')::uuid
  into prior_amount, prior_recipient
  from public.gca_ledger
  where user_id = sender and request_id = p_request_id and kind = 'transfer-debit';
  if found then
    if prior_amount is distinct from -p_amount
       or prior_recipient is distinct from p_recipient then
      raise exception 'Request id already used' using errcode = '22023';
    end if;
    return jsonb_build_object('ok', true, 'duplicate', true, 'balance', sender_balance);
  end if;

  if sender_balance < p_amount then
    raise exception 'Insufficient funds' using errcode = '22003';
  end if;

  update public.gca_wallets
  set balance = balance - p_amount, updated_at = now()
  where user_id = sender
  returning balance into sender_balance;

  update public.gca_wallets
  set balance = balance + p_amount, updated_at = now()
  where user_id = p_recipient
  returning balance into recipient_balance;

  insert into public.gca_ledger (user_id, amount, label, kind, request_id, metadata)
  values
    (sender, -p_amount, 'Player transfer', 'transfer-debit', p_request_id, jsonb_build_object('recipient', p_recipient)),
    (p_recipient, p_amount, 'Player transfer', 'transfer-credit', p_request_id, jsonb_build_object('sender', sender));

  return jsonb_build_object('ok', true, 'duplicate', false, 'balance', sender_balance);
end;
$$;

revoke all on function public.gca_transfer_money(uuid, numeric, uuid) from public, anon;
grant execute on function public.gca_transfer_money(uuid, numeric, uuid) to authenticated;
