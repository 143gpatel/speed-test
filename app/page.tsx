"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Gauge from "@/components/Gauge";
import SpeedGraph from "@/components/SpeedGraph";
import StatCard from "@/components/StatCard";
import {
  getInternetBrandInfo,
  getNetworkInfo,
  getTestLocation,
  testDownload,
  testPing,
  testUpload,
  type LivePoint
} from "@/lib/speedTest";

type TestState = "idle" | "ping" | "download" | "upload" | "done" | "error";
const initialGraph: LivePoint[] = [];

export default function HomePage() {
  const [ping, setPing] = useState(0);
  const [download, setDownload] = useState(0);
  const [upload, setUpload] = useState(0);
  const [status, setStatus] = useState<TestState>("idle");
  const [error, setError] = useState<string>("");
  const [locationLabel, setLocationLabel] = useState<string>("Location will be used for the nearest test edge.");
  const [brandLabel, setBrandLabel] = useState<string>("Internet brand will appear here.");
  const [brandDetail, setBrandDetail] = useState<string>("");
  const [networkLabel, setNetworkLabel] = useState<string>("Connection info will appear here.");
  const [networkDetail, setNetworkDetail] = useState<string>("");
  const [edgeLabel, setEdgeLabel] = useState<string>("Cloudflare edge will appear here.");
  const [traceLabel, setTraceLabel] = useState<string>("");
  const [graphData, setGraphData] = useState<LivePoint[]>(initialGraph);

  useEffect(() => {
  let active = true;

  const loadSnapshot = async () => {
  const [location, network, brand] = await Promise.all([getTestLocation(), getNetworkInfo(), getInternetBrandInfo()]);

  if (!active) return;
  setLocationLabel(location ? `Using your location: ${location.label}` : "Location permission not granted; using the nearest test edge.");
  setNetworkLabel(network?.browserLabel ?? "Connection info not available.");
  setNetworkDetail(network?.browserDetail ?? "");
  setEdgeLabel(network?.edgeLabel ?? "Cloudflare edge unavailable.");
  setTraceLabel(network?.traceLabel ?? "");
  setBrandLabel(brand?.brand ?? "Internet brand not detected.");
      setBrandDetail(brand?.detail ?? "");
    };

    void loadSnapshot();
    return () => {
      active = false;
    };
  }, []);

  const statusText = useMemo(() => {
    switch (status) {
      case "ping":
        return "Measuring ping...";
      case "download":
        return "Testing download speed...";
      case "upload":
        return "Testing upload speed...";
      case "done":
        return "Test complete";
      case "error":
        return "Something went wrong";
      default:
        return "Ready to test";
    }
  }, [status]);
  const pushPoint = (point: LivePoint) => {
    setGraphData((prev) => [...prev, point].slice(-14));
  };
  const handleStart = async () => {
    setError("");
    setGraphData([]);
  setPing(0);
  setDownload(0);
  setUpload(0);
    try {
      const [location, network, brand] = await Promise.all([getTestLocation(), getNetworkInfo(), getInternetBrandInfo()]);
      setLocationLabel(location ? `Using your location: ${location.label}` : "Location permission not granted; using the nearest test edge.");
  setNetworkLabel(network?.browserLabel ?? "Connection info not available.");
  setNetworkDetail(network?.browserDetail ?? "");
  setEdgeLabel(network?.edgeLabel ?? "Cloudflare edge unavailable.");
  setTraceLabel(network?.traceLabel ?? "");
  setBrandLabel(brand?.brand ?? "Internet brand not detected.");
  setBrandDetail(brand?.detail ?? "");
  setStatus("ping");
  const measuredPing = await testPing();
  setPing(measuredPing);
      setStatus("download");
      const measuredDownload = await testDownload((speed, point) => {
        setDownload(speed);
        pushPoint(point);
      });
      setDownload(measuredDownload);
      setStatus("upload");
      const measuredUpload = await testUpload((speed, point) => {
        setUpload(speed);
        pushPoint(point);
      });
      setUpload(measuredUpload);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unknown error occurred.");
    }
  };
  const loading = ["ping", "download", "upload"].includes(status);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-6 shadow-glow backdrop-blur-xl md:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-sky-400/20 blur-3xl" />

        <div className="relative flex flex-col gap-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 inline-flex rounded-full border border-cyan-400/35 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
                Premium Internet Speed Test
              </p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
                Clean, accurate, and real-time speed analytics
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                Measure ping, download, and upload in one click with live charting and a refined dashboard experience.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleStart}
                disabled={loading}
                className="rounded-xl bg-gradient-to-r from-sky-400 to-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-glow transition duration-200 hover:scale-[1.02] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? statusText : "Start Speed Test"}
              </button>
              <Link
                href="/history"
                className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/10"
              >
                View History
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Status" value={statusText} subtext={error || "Everything is ready. Hit start to begin your test."} />
            <StatCard label="Ping" value={`${ping} ms`} subtext="Lower ping means better responsiveness" />
            <StatCard label="Session" value={status === "done" ? "Completed" : "In Progress"} subtext="Runs directly in your browser" />
            <StatCard label="Internet brand" value={brandLabel} subtext={brandDetail || "Brand/ISP detected from your public network route"} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Location</p>
              <p className="mt-1 text-sm text-slate-200">{locationLabel}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Network type</p>
              <p className="mt-1 text-sm text-slate-200">{networkLabel}</p>
              {networkDetail ? <p className="mt-1 text-xs text-slate-400">{networkDetail}</p> : null}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Test edge</p>
              <p className="mt-1 text-sm text-slate-200">{edgeLabel}</p>
              {traceLabel ? <p className="mt-1 text-xs text-slate-400">{traceLabel}</p> : null}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Internet brand</p>
              <p className="mt-1 text-sm text-slate-200">{brandLabel}</p>
              {brandDetail ? <p className="mt-1 text-xs text-slate-400">{brandDetail}</p> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1.1fr_1.8fr]">
        <Gauge value={download} label="Download Speed" max={300} />
        <Gauge value={upload} label="Upload Speed" max={300} />
        <SpeedGraph data={graphData} />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Download" value={`${download.toFixed(2)} Mbps`} subtext="Higher is better for streaming and downloads" />
        <StatCard label="Upload" value={`${upload.toFixed(2)} Mbps`} subtext="Important for video calls and cloud backup" />
        <StatCard
          label="Notes"
          value="Real-world test"
          subtext="Powered by Cloudflare endpoints and browser-level measurements"
        />
      </section>
    </main>
  );
}
