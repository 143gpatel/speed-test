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

function round(value: number) {
  return Math.max(0, Number(value.toFixed(2)));
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
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
    parts.push(connection.type === "wifi" ? "Wi‑Fi" : connection.type.toUpperCase());
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

  return parts.length ? parts.join(" • ") : null;
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
      ? `Route ${trace.loc}${trace.warp === "on" ? " • WARP on" : ""}`
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

  for (let i = 0; i < 5; i++) {
    const { elapsed } = await timedFetch(`${TRACE_URL}?t=${Date.now()}-${i}`);
    samples.push(elapsed);
    await delay(75);
  }

  return Math.max(1, Math.round(median(samples)));
}

export async function testDownload(onProgress?: (speedMbps: number, point: LivePoint) => void) {
  const sampleCount = 4;
  const streamCount = 2;
  const chunkBytes = 2 * 1024 * 1024;
  const samples: number[] = [];

  // Warmup stream to stabilize the connection before taking the real samples.
  const warmupResponse = await fetch(`${DOWNLOAD_URL}?bytes=${256 * 1024}&t=${Date.now()}-warmup`, {
    cache: "no-store"
  });
  const warmupReader = warmupResponse.body?.getReader();
  if (warmupReader) {
    while (true) {
      const { done } = await warmupReader.read();
      if (done) break;
    }
  }

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
    const sampleStart = performance.now();

    const bytesTransferred = await Promise.all(
      Array.from({ length: streamCount }, async (_, streamIndex) => {
        const response = await fetch(`${DOWNLOAD_URL}?bytes=${chunkBytes}&t=${Date.now()}-${sampleIndex}-${streamIndex}`, {
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error(`Download test failed with status ${response.status}.`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Download stream is not available.");
        }

        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.byteLength;
        }

        return received;
      })
    );

    const elapsedSec = Math.max((performance.now() - sampleStart) / 1000, 0.05);
    const sampleSpeed = round((bytesTransferred.reduce((sum, bytes) => sum + bytes, 0) * 8) / elapsedSec / 1024 / 1024);
    samples.push(sampleSpeed);

    const smoothedSpeed = round(median(samples.slice(-3)));
    onProgress?.(smoothedSpeed, {
      time: new Date().toLocaleTimeString(),
      download: smoothedSpeed,
      upload: 0
    });

    await delay(60);
  }

  return round(median(samples));
}

export async function testUpload(onProgress?: (speedMbps: number, point: LivePoint) => void) {
  const sampleCount = 4;
  const streamCount = 2;
  const sampleBytes = 2 * 1024 * 1024;
  const payload = new Uint8Array(sampleBytes).fill(7);
  const samples: number[] = [];

  // Warmup request to reduce connection setup bias from the first measured sample.
  const warmupResponse = await fetch(`${UPLOAD_URL}?t=${Date.now()}-warmup`, {
    method: "POST",
    cache: "no-store",
    body: payload.slice(0, 256 * 1024)
  });
  if (!warmupResponse.ok) {
    throw new Error(`Upload test failed with status ${warmupResponse.status}.`);
  }

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
    const sampleStart = performance.now();

    const uploadedBytes = await Promise.all(
      Array.from({ length: streamCount }, async (_, streamIndex) => {
        const { response } = await timedFetch(`${UPLOAD_URL}?t=${Date.now()}-${sampleIndex}-${streamIndex}`, {
          method: "POST",
          cache: "no-store",
          body: payload
        });

        if (!response.ok) {
          throw new Error(`Upload test failed with status ${response.status}.`);
        }

        return sampleBytes;
      })
    );

    const elapsedSec = Math.max((performance.now() - sampleStart) / 1000, 0.05);
    const sampleSpeed = round((uploadedBytes.reduce((sum, bytes) => sum + bytes, 0) * 8) / elapsedSec / 1024 / 1024);
    samples.push(sampleSpeed);

    const smoothedSpeed = round(median(samples.slice(-3)));
    onProgress?.(smoothedSpeed, {
      time: new Date().toLocaleTimeString(),
      download: 0,
      upload: smoothedSpeed
    });

    await delay(60);
  }

  return round(median(samples));
}
