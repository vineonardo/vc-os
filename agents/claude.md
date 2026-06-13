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

Do not expose secret values in logs or comments.
