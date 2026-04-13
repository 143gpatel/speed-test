import type { SpeedHistoryRow } from "@/lib/db";

type HistoryTableProps = {
  rows: SpeedHistoryRow[];
};

export default function HistoryTable({ rows }: HistoryTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/80 backdrop-blur-xl shadow-glow">
      <div className="border-b border-white/10 p-5">
        <h3 className="text-lg font-semibold">Recent Test History</h3>
        <p className="text-sm text-slate-300">Saved speed test results from your recent sessions.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/5 text-slate-300">
            <tr>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Ping</th>
              <th className="px-5 py-3">Download</th>
              <th className="px-5 py-3">Upload</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-5 py-4 text-slate-400" colSpan={4}>
                  No saved results yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-white/10 transition-colors hover:bg-white/[0.03]">
                  <td className="px-5 py-4">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-5 py-4">{row.ping} ms</td>
                  <td className="px-5 py-4">{Number(row.download).toFixed(2)} Mbps</td>
                  <td className="px-5 py-4">{Number(row.upload).toFixed(2)} Mbps</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
