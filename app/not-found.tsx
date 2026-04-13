import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <section className="w-full rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-8 text-center shadow-glow backdrop-blur-xl sm:p-10">
        <p className="mx-auto inline-flex rounded-full border border-cyan-400/35 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
          404
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
          The page you’re looking for doesn’t exist or was moved. Head back to the dashboard to run a speed test.
        </p>

        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/"
            className="rounded-xl bg-gradient-to-r from-sky-400 to-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
          >
            Back to Dashboard
          </Link>
          <Link
            href="/history"
            className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/10"
          >
            View History
          </Link>
        </div>
      </section>
    </main>
  );
}