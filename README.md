# Venture Wolf

Credit-gated AI founder screening platform for Venture Wolf.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000/chat.

## Stack

- Next.js App Router
- Supabase Auth, Postgres, Storage
- OpenAI for Wolf chat and generated founder assets
- Razorpay for credit purchases
- React PDF and XLSX export for generated files

## Supabase

Project: X-Storm (`vawoypfirghfvlktnuub`)

Schema files:
- `supabase/schema.sql`
- `supabase/policy-optimizations.sql`

## Required Env

`.env.local` already contains `OPENAI_API_KEY`. Add the Supabase and Razorpay values before using persistent auth/payments:

```env
NEXT_PUBLIC_SUPABASE_URL=https://vawoypfirghfvlktnuub.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
NEXT_PUBLIC_RAZORPAY_KEY_ID=

NEXT_PUBLIC_APP_URL=http://localhost:3000
DEVANG_EMAIL=devang@venturewolf.in
FREE_CREDITS_ON_SIGNUP=10
MIN_CREDIT_PURCHASE=100
CREDIT_PRICE_PAISE=1000
```

Set `X_STORM_DEMO_FALLBACK=true` only when you want local chat to stream a synthetic Wolf reply instead of calling OpenAI.
