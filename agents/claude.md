# Venture Wolf Project Context

Build the Venture Wolf AI Founder Platform from the PRD and concept note at https://vw-ikawn-concept.netlify.app/.

Core product:
- Founder-facing Wolf chat assistant powered by OpenAI.
- Credit-gated actions: chat replies, pitch deck, financial model, investor memo.
- Supabase project: X-Storm (`vawoypfirghfvlktnuub`).
- Investor dashboard for Devang showing prepared/scored founders only.
- Styling should match the concept: dark black/surface/card, gold accent, restrained investor-grade UI.

Key env:
- Existing `.env.local` contains `OPENAI_API_KEY`; reuse it.
- Supabase public URL is `https://vawoypfirghfvlktnuub.supabase.co`.
- Required deployment vars: `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, Razorpay keys, `DEVANG_EMAIL`.
- If X-Storm's public API hostname returns NXDOMAIN, set `X_STORM_SUPABASE_DISABLED=true`.
- While Supabase is disabled, Vercel Blob (`BLOB_READ_WRITE_TOKEN`) stores demo chat history, demo credit balance, and generated PDFs/XLSX assets for each browser session.
- On Fly, prefer the Postgres path: `DATABASE_URL` stores demo sessions, messages, credits, generated asset bytes, and dashboard rows. It takes precedence over Blob.

Do not expose secret values in logs or comments.
