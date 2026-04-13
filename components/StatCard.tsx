type StatCardProps = {
  label: string;
  value: string;
  subtext?: string;
};

export default function StatCard({ label, value, subtext }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/75 to-slate-950/75 p-5 backdrop-blur-xl shadow-glow">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <h3 className="mt-2 text-3xl font-semibold tracking-tight">{value}</h3>
      {subtext ? <p className="mt-2 text-xs leading-5 text-slate-400">{subtext}</p> : null}
    </div>
  );
}
