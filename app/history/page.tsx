import Link from "next/link";
import HistoryTable from "@/components/HistoryTable";
import { getSpeedHistory, type SpeedHistoryRow } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  let rows: SpeedHistoryRow[] = [];
  try {
    rows = await getSpeedHistory(25);
  } catch {
    rows = [];
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/85 to-slate-950/85 p-6 shadow-glow backdrop-blur-xl md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 inline-flex rounded-full border border-indigo-400/35 bg-indigo-400/10 px-3 py-1 text-xs font-medium text-indigo-200">History</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Speed Test History</h1>
          <p className="mt-2 text-sm text-slate-300">Your latest saved internet speed performance snapshots.</p>
        </div>
        <Link href="/" className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-slate-100 hover:bg-white/10">
          Back to Dashboard
        </Link>
      </div>

      <HistoryTable rows={rows} />
    </main>
  );
}
