import { NextRequest, NextResponse } from "next/server";
import { TransportId } from "@/lib/types";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

const MODE_MAP: Record<TransportId, string> = {
  walk: "walking",
  bike: "bicycling",
  train: "transit",
  car: "driving",
};

export async function GET(req: NextRequest) {
  if (!GOOGLE_MAPS_API_KEY) {
    return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY が設定されていません" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const originLat = searchParams.get("originLat");
  const originLng = searchParams.get("originLng");
  const destLat = searchParams.get("destLat");
  const destLng = searchParams.get("destLng");
  const transport = searchParams.get("transport") as TransportId | null;

  if (!originLat || !originLng || !destLat || !destLng || !transport || !MODE_MAP[transport]) {
    return NextResponse.json({ error: "パラメータが不正です" }, { status: 400 });
  }

  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", `${originLat},${originLng}`);
  url.searchParams.set("destination", `${destLat},${destLng}`);
  url.searchParams.set("mode", MODE_MAP[transport]);
  url.searchParams.set("language", "ja");
  url.searchParams.set("key", GOOGLE_MAPS_API_KEY);

  const res = await fetch(url.toString());
  const data = await res.json();
  const leg = data.routes?.[0]?.legs?.[0];

  if (!leg) {
    return NextResponse.json({ error: data.status ?? "ROUTE_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    durationMinutes: Math.round(leg.duration.value / 60),
    distanceMeters: leg.distance.value as number,
    polyline: (data.routes[0].overview_polyline?.points as string | undefined) ?? null,
  });
}
