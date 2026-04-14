export type LivePoint = {
  time: string;
  download: number;
  upload: number;
};

export type TestLocation = {
  latitude: number;
  longitude: number;
  label: string;
};

export type NetworkInfo = {
  browserLabel: string;
  browserDetail: string | null;
  edgeLabel: string;
  traceLabel: string | null;
};

export type InternetBrandInfo = {
  brand: string | null;
  detail: string | null;
};

const SPEED_TEST_ORIGIN = "https://speed.cloudflare.com";
const TRACE_URL = `${SPEED_TEST_ORIGIN}/cdn-cgi/trace`;
const DOWNLOAD_URL = `${SPEED_TEST_ORIGIN}/__down`;
const UPLOAD_URL = `${SPEED_TEST_ORIGIN}/__up`;
const BYTES_PER_MEGABIT = (1024 * 1024) / 8;
const DOWNLOAD_TEST_DURATION_MS = 6500;
const UPLOAD_TEST_DURATION_MS = 5500;
const DOWNLOAD_ROUND_TARGET_MS = 1200;
const UPLOAD_ROUND_TARGET_MS = 1000;
const MIN_CHUNK_BYTES = 512 * 1024;
const MAX_DOWNLOAD_CHUNK_BYTES = 12 * 1024 * 1024;
const MAX_UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;

type SpeedDirection = "download" | "upload";

type ConnectionStats = {
  downlinkMbps: number | null;
  hardwareConcurrency: number;
};

type AdaptiveSpeedTestOptions = {
  direction: SpeedDirection;
  maxRounds: number;
  minRounds: number;
  onProgress?: (speedMbps: number, point: LivePoint) => void;
  roundTargetMs: number;
  targetDurationMs: number;
};

function round(value: number) {
  return Math.max(0, Number(value.toFixed(2)));
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function percentile(values: number[], percentileValue: number) {
  if (!values.length) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sorted[lower];

  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function trimmedMean(values: number[], trimRatio = 0.1) {
  if (!values.length) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const maxTrim = Math.max(0, Math.floor((sorted.length - 1) / 2));
  const trimCount = Math.min(Math.floor(sorted.length * trimRatio), maxTrim);
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);

  return average(trimmed.length ? trimmed : sorted);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

async function timedFetch(url: string, init?: RequestInit) {
  const start = performance.now();
  const response = await fetch(url, { cache: "no-store", ...init });
  const elapsed = performance.now() - start;
  return { response, elapsed };
}

function parseTrace(text: string) {
  return text.split("\n").reduce<Record<string, string>>((acc, line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length) {
      acc[key.trim()] = rest.join("=").trim();
    }
    return acc;
  }, {});
}

function getBrowserConnectionLabel() {
  if (typeof navigator === "undefined") return null;

  const connection = (navigator as Navigator & {
    connection?: {
      type?: string;
      effectiveType?: string;
      downlink?: number;
      rtt?: number;
      saveData?: boolean;
    };
  }).connection as
    | {
        type?: string;
        effectiveType?: string;
        downlink?: number;
        rtt?: number;
        saveData?: boolean;
      }
    | undefined;

  if (!connection) return null;

  const parts: string[] = [];

  if (connection.type) {
    parts.push(connection.type === "wifi" ? "Wi-Fi" : connection.type.toUpperCase());
  } else if (connection.effectiveType) {
    parts.push(connection.effectiveType.toUpperCase());
  }

  if (typeof connection.downlink === "number") {
    parts.push(`${connection.downlink.toFixed(1)} Mbps`);
  }

  if (typeof connection.rtt === "number") {
    parts.push(`${connection.rtt} ms RTT`);
  }

  if (connection.saveData) {
    parts.push("Data saver on");
  }

  return parts.length ? parts.join(" | ") : null;
}

function getConnectionStats(): ConnectionStats {
  if (typeof navigator === "undefined") {
    return {
      downlinkMbps: null,
      hardwareConcurrency: 4
    };
  }

  const connection = (navigator as Navigator & {
    connection?: {
      downlink?: number;
    };
  }).connection;

  return {
    downlinkMbps:
      typeof connection?.downlink === "number" && connection.downlink > 0 ? connection.downlink : null,
    hardwareConcurrency: navigator.hardwareConcurrency ?? 4
  };
}

function getMaxStreams(direction: SpeedDirection, hardwareConcurrency: number) {
  const absoluteMax = direction === "download" ? 8 : 6;
  const cpuCap = Math.ceil(hardwareConcurrency * 0.75);
  const minimum = direction === "download" ? 3 : 2;
  return clamp(cpuCap, minimum, absoluteMax);
}

function getAdaptiveStreamTarget(
  direction: SpeedDirection,
  estimatedMbps: number | null,
  maxStreams: number
) {
  const normalizedMbps = estimatedMbps ?? 35;

  const target =
    direction === "download"
      ? normalizedMbps >= 350
        ? 8
        : normalizedMbps >= 200
          ? 7
          : normalizedMbps >= 120
            ? 6
            : normalizedMbps >= 60
              ? 5
              : normalizedMbps >= 20
                ? 4
                : 3
      : normalizedMbps >= 200
        ? 6
        : normalizedMbps >= 100
          ? 5
          : normalizedMbps >= 40
            ? 4
            : normalizedMbps >= 15
              ? 3
              : 2;

  const minimum = direction === "download" ? 3 : 2;
  return clamp(target, minimum, maxStreams);
}

function estimateChunkSizeBytes(
  estimatedMbps: number | null,
  streams: number,
  roundTargetMs: number,
  maxBytes: number
) {
  const normalizedMbps = Math.max(estimatedMbps ?? 40, 12);
  const bytesPerSecondPerStream = (normalizedMbps * BYTES_PER_MEGABIT) / Math.max(1, streams);
  const targetBytes = bytesPerSecondPerStream * (roundTargetMs / 1000);

  return clamp(Math.round(targetBytes), MIN_CHUNK_BYTES, maxBytes);
}

function computeLiveSpeed(samples: number[]) {
  const recentSamples = samples.slice(-5);

  if (!recentSamples.length) return 0;

  if (recentSamples.length === 1) return round(recentSamples[0]);
  if (recentSamples.length === 2) return round(average(recentSamples));

  const center = median(recentSamples);
  const clustered = recentSamples.filter((sample) => sample >= center * 0.85 && sample <= center * 1.15);

  return round(trimmedMean(clustered.length >= 3 ? clustered : recentSamples, 0.1));
}

function computeFinalSpeed(samples: number[], totalTransferredBytes: number, totalElapsedMs: number) {
  if (!samples.length) return 0;

  const usableSamples = samples.length > 5 ? samples.slice(1) : samples;
  const stableWindow = usableSamples.slice(-Math.max(3, Math.ceil(usableSamples.length * 0.7)));
  const sampleCenter = trimmedMean(stableWindow, 0.15);
  const throughputAverage = totalElapsedMs > 0 ? round((totalTransferredBytes * 8) / (totalElapsedMs / 1000) / 1024 / 1024) : 0;

  if (!throughputAverage) {
    return sampleCenter;
  }

  const balanced = stableWindow.length >= 4 ? sampleCenter * 0.6 + throughputAverage * 0.4 : sampleCenter * 0.45 + throughputAverage * 0.55;
  return round(balanced);
}

async function readResponseBytes(response: Response, errorPrefix: string) {
  if (!response.ok) {
    throw new Error(`${errorPrefix} failed with status ${response.status}.`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error(`${errorPrefix} stream is not available.`);
  }

  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
  }

  return received;
}

function toRequestBody(payload: Uint8Array) {
  return payload.slice().buffer;
}

async function warmupDownload() {
  const warmupResponse = await fetch(`${DOWNLOAD_URL}?bytes=${512 * 1024}&t=${Date.now()}-warmup`, {
    cache: "no-store"
  });

  await readResponseBytes(warmupResponse, "Download warmup");
}

async function warmupUpload() {
  const warmupPayload = new Uint8Array(256 * 1024).fill(7);
  const warmupResponse = await fetch(`${UPLOAD_URL}?t=${Date.now()}-warmup`, {
    method: "POST",
    cache: "no-store",
    body: toRequestBody(warmupPayload)
  });

  if (!warmupResponse.ok) {
    throw new Error(`Upload warmup failed with status ${warmupResponse.status}.`);
  }
}

async function runDownloadRound(roundIndex: number, streamCount: number, chunkBytes: number) {
  const bytesTransferred = await Promise.all(
    Array.from({ length: streamCount }, async (_, streamIndex) => {
      const response = await fetch(
        `${DOWNLOAD_URL}?bytes=${chunkBytes}&t=${Date.now()}-${roundIndex}-${streamIndex}`,
        {
          cache: "no-store"
        }
      );

      return readResponseBytes(response, "Download test");
    })
  );

  return bytesTransferred.reduce((sum, bytes) => sum + bytes, 0);
}

async function runUploadRound(roundIndex: number, streamCount: number, payload: Uint8Array) {
  const uploadedBytes = await Promise.all(
    Array.from({ length: streamCount }, async (_, streamIndex) => {
      const { response } = await timedFetch(`${UPLOAD_URL}?t=${Date.now()}-${roundIndex}-${streamIndex}`, {
        method: "POST",
        cache: "no-store",
        body: toRequestBody(payload)
      });

      if (!response.ok) {
        throw new Error(`Upload test failed with status ${response.status}.`);
      }

      return payload.byteLength;
    })
  );

  return uploadedBytes.reduce((sum, bytes) => sum + bytes, 0);
}

async function runAdaptiveSpeedTest({
  direction,
  maxRounds,
  minRounds,
  onProgress,
  roundTargetMs,
  targetDurationMs
}: AdaptiveSpeedTestOptions) {
  const { downlinkMbps, hardwareConcurrency } = getConnectionStats();
  const maxStreams = getMaxStreams(direction, hardwareConcurrency);
  const maxChunkBytes = direction === "download" ? MAX_DOWNLOAD_CHUNK_BYTES : MAX_UPLOAD_CHUNK_BYTES;
  const samples: number[] = [];
  let totalTransferredBytes = 0;
  let totalMeasuredMs = 0;
  let estimatedMbps = downlinkMbps;
  let streamCount = getAdaptiveStreamTarget(direction, estimatedMbps, maxStreams);

  if (direction === "download") {
    await warmupDownload();
  } else {
    await warmupUpload();
  }

  const testStart = performance.now();

  for (let roundIndex = 0; roundIndex < maxRounds; roundIndex++) {
    const chunkBytes = estimateChunkSizeBytes(estimatedMbps, streamCount, roundTargetMs, maxChunkBytes);
    const roundStart = performance.now();
    const transferredBytes =
      direction === "download"
        ? await runDownloadRound(roundIndex, streamCount, chunkBytes)
        : await runUploadRound(roundIndex, streamCount, new Uint8Array(chunkBytes).fill(7));

    const elapsedSec = Math.max((performance.now() - roundStart) / 1000, 0.05);
    const sampleSpeed = round((transferredBytes * 8) / elapsedSec / 1024 / 1024);
    samples.push(sampleSpeed);
    totalTransferredBytes += transferredBytes;
    totalMeasuredMs += performance.now() - roundStart;

    const recentWindow = samples.slice(-Math.min(samples.length, 4));
    estimatedMbps = percentile(recentWindow, 0.75);

    const liveSpeed = computeLiveSpeed(samples);
    onProgress?.(liveSpeed, {
      time: new Date().toLocaleTimeString(),
      download: direction === "download" ? liveSpeed : 0,
      upload: direction === "upload" ? liveSpeed : 0
    });

    const totalElapsed = performance.now() - testStart;
    if (roundIndex + 1 >= minRounds && totalElapsed >= targetDurationMs) {
      break;
    }

    const targetStreams = getAdaptiveStreamTarget(direction, estimatedMbps, maxStreams);
    if (targetStreams > streamCount) {
      streamCount += 1;
    } else if (targetStreams < streamCount) {
      streamCount -= 1;
    }

    await delay(70);
  }

  return computeFinalSpeed(samples, totalTransferredBytes, totalMeasuredMs);
}

export async function getNetworkInfo(): Promise<NetworkInfo | null> {
  try {
    const browserLabel = getBrowserConnectionLabel() ?? "Connection info not supported";
    const { response } = await timedFetch(`${TRACE_URL}?t=${Date.now()}-info`);

    if (!response.ok) {
      return {
        browserLabel,
        browserDetail: null,
        edgeLabel: "Cloudflare edge unavailable",
        traceLabel: null
      };
    }

    const trace = parseTrace(await response.text());
    const edgeLabel = trace.colo ? `Cloudflare edge ${trace.colo}` : "Cloudflare edge unavailable";
    const traceLabel = trace.loc
      ? `Route ${trace.loc}${trace.warp === "on" ? " | WARP on" : ""}`
      : trace.warp
        ? `WARP ${trace.warp}`
        : null;

    return {
      browserLabel,
      browserDetail: trace.ip ? `Public IP ${trace.ip}` : null,
      edgeLabel,
      traceLabel
    };
  } catch {
    return {
      browserLabel: getBrowserConnectionLabel() ?? "Connection info not available",
      browserDetail: null,
      edgeLabel: "Cloudflare edge unavailable",
      traceLabel: null
    };
  }
}

export async function getInternetBrandInfo(): Promise<InternetBrandInfo | null> {
  try {
    const response = await fetch("/api/network-info", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      success?: boolean;
      brand?: string | null;
      detail?: string | null;
    };

    if (!data.success) {
      return null;
    }

    return {
      brand: data.brand ?? null,
      detail: data.detail ?? null
    };
  } catch {
    return null;
  }
}

export async function getTestLocation(): Promise<TestLocation | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return null;
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 60_000
      });
    });

    const { latitude, longitude } = position.coords;
    return {
      latitude,
      longitude,
      label: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`
    };
  } catch {
    return null;
  }
}

export async function testPing() {
  const samples: number[] = [];

  for (let i = 0; i < 6; i++) {
    const { elapsed } = await timedFetch(`${TRACE_URL}?t=${Date.now()}-${i}`);
    samples.push(elapsed);
    await delay(i === 0 ? 120 : 75);
  }

  return Math.max(1, Math.round(median(samples.slice(1))));
}

export async function testDownload(onProgress?: (speedMbps: number, point: LivePoint) => void) {
  return runAdaptiveSpeedTest({
    direction: "download",
    targetDurationMs: DOWNLOAD_TEST_DURATION_MS,
    minRounds: 4,
    maxRounds: 8,
    roundTargetMs: DOWNLOAD_ROUND_TARGET_MS,
    onProgress
  });
}

export async function testUpload(onProgress?: (speedMbps: number, point: LivePoint) => void) {
  return runAdaptiveSpeedTest({
    direction: "upload",
    targetDurationMs: UPLOAD_TEST_DURATION_MS,
    minRounds: 4,
    maxRounds: 7,
    roundTargetMs: UPLOAD_ROUND_TARGET_MS,
    onProgress
  });
}
