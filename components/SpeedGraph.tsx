"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { LivePoint } from "@/lib/speedTest";

type SpeedGraphProps = {
  data: LivePoint[];
};

export default function SpeedGraph({ data }: SpeedGraphProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-5 backdrop-blur-xl shadow-glow">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Live Speed Graph</h3>
          <p className="text-sm text-slate-300">Download and upload values update live while the test is running.</p>
        </div>
      </div>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
            <XAxis dataKey="time" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
            <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                background: "rgba(2, 6, 23, 0.9)",
                border: "1px solid rgba(148,163,184,0.25)",
                borderRadius: "12px",
                color: "#e2e8f0"
              }}
            />
            <Line type="monotone" dataKey="download" name="Download" stroke="#38bdf8" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="upload" name="Upload" stroke="#818cf8" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
