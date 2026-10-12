# Account and wallet backend

The Supabase migration `supabase/migrations/20261012160537_gcav_accounts_wallet.sql`
adds player profiles, an AED wallet, a private transaction ledger, and a safe
player-to-player transfer function. New Supabase Auth users receive an account
and AED 500 welcome credit. The existing `insider_registrations` table is not
changed.

All three game tables have row-level security enabled. Signed-in users can read
only their own profile, balance, and ledger. They can update only their profile
display name. Wallet and ledger writes are not granted to browser clients;
transfers go through `gca_transfer_money`, which checks the authenticated sender,
amount, balance, recipient and request ID in one transaction.

## Vercel environment

Set these variables on the dedicated Vercel project for this repository:

```dotenv
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

These are public client configuration values, not database passwords. Do not
add a Supabase secret key or service-role key to the frontend or commit it to
Git. `/api/config` returns only these two public values.

## API routes

- `GET /api/config` returns the public Supabase URL and publishable key.
- `GET /api/wallet` requires a Supabase access token and returns the signed-in
  player's profile, balance, and latest 100 ledger entries.
- `POST /api/transfer` requires a Supabase access token and accepts
  `{ "recipientId": "<uuid>", "amount": 25, "requestId": "<uuid>" }`.
  The database performs the transfer atomically and makes retries idempotent.

The current real-time game process still uses its existing multiplayer
connection and wallet store. These routes establish the account and cloud-bank
boundary; wiring the live game actions to this wallet is a separate migration
step so the local session balance and cloud balance are never silently mixed.
