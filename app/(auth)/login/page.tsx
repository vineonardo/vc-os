import Link from "next/link";
import { loginAction } from "@/app/(auth)/actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-blackwolf px-4 text-text">
      <section className="w-full max-w-md border border-white/10 bg-card p-6">
        <div className="mb-7">
          <div className="mb-3 inline-grid h-11 w-11 place-items-center border border-gold/40 bg-gold/10 font-heading text-lg font-bold text-gold">
            W
          </div>
          <h1 className="font-heading text-2xl font-semibold">Wolf by Venture Wolf</h1>
          <p className="mt-2 text-sm text-muted">Sign in to continue founder screening.</p>
        </div>

        {searchParams?.error && (
          <div className="mb-4 border border-red/30 bg-red/10 px-3 py-2 text-sm text-red">
            {searchParams.error}
          </div>
        )}

        <form action={loginAction} className="space-y-4">
          <label className="block text-sm">
            <span className="text-muted">Email</span>
            <input
              required
              name="email"
              type="email"
              className="mt-2 h-11 w-full border border-white/10 bg-surface px-3 text-text outline-none focus:border-gold/60"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Password</span>
            <input
              required
              name="password"
              type="password"
              className="mt-2 h-11 w-full border border-white/10 bg-surface px-3 text-text outline-none focus:border-gold/60"
            />
          </label>
          <button className="h-11 w-full bg-gold px-4 text-sm font-semibold text-blackwolf transition hover:bg-[#ffd45d]">
            Login
          </button>
        </form>

        <p className="mt-5 text-sm text-muted">
          New founder?{" "}
          <Link href="/signup" className="text-gold hover:underline">
            Create an account
          </Link>
        </p>
      </section>
    </main>
  );
}
