import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type IpWhoIsResponse = {
  success?: boolean;
  connection?: {
    isp?: string;
    org?: string;
    asn?: number;
    domain?: string;
  };
};

function pickBrand(connection?: IpWhoIsResponse["connection"]) {
  const candidates = [connection?.isp, connection?.org, connection?.domain].filter(Boolean) as string[];

  if (!candidates.length) return null;

  const primary = candidates[0];
  return primary.replace(/\bPVT\.?\s?LTD\.?\b/gi, "").replace(/\s{2,}/g, " ").trim();
}

export async function GET() {
  try {
    const response = await fetch("https://ipwho.is/?output=json", { cache: "no-store" });
    const data = (await response.json()) as IpWhoIsResponse;

    if (!response.ok || data.success === false) {
      return NextResponse.json(
        {
          success: false,
          brand: null,
          detail: null
        },
        { status: 200 }
      );
    }

    const brand = pickBrand(data.connection);
    const detailParts: string[] = [];

    if (data.connection?.org) detailParts.push(data.connection.org);
    if (data.connection?.domain) detailParts.push(data.connection.domain);

    return NextResponse.json({
      success: true,
      brand,
      detail: detailParts.length ? detailParts.join(" • ") : null
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        brand: null,
        detail: null
      },
      { status: 200 }
    );
  }
}