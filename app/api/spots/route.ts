import { NextRequest, NextResponse } from "next/server";
import { BudgetId, MoodId, Spot } from "@/lib/types";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const SEARCH_RADIUS_METERS = 1500;

interface MoodQuery {
  type: string;
  keyword?: string;
  categoryLabel: string;
  stayMinutes: number;
  defaultPriceLevel: number;
}

const MOOD_QUERIES: Record<MoodId, MoodQuery[]> = {
  mattari: [
    { type: "park", categoryLabel: "公園", stayMinutes: 40, defaultPriceLevel: 0 },
    { type: "cafe", categoryLabel: "カフェ", stayMinutes: 30, defaultPriceLevel: 1 },
  ],
  gourmet: [
    { type: "restaurant", categoryLabel: "レストラン", stayMinutes: 50, defaultPriceLevel: 2 },
    { type: "bar", categoryLabel: "バー", stayMinutes: 45, defaultPriceLevel: 2 },
  ],
  active: [
    { type: "tourist_attraction", categoryLabel: "観光名所", stayMinutes: 40, defaultPriceLevel: 1 },
    { type: "gym", categoryLabel: "アクティビティ施設", stayMinutes: 60, defaultPriceLevel: 2 },
  ],
  photo: [
    {
      type: "tourist_attraction",
      keyword: "フォトスポット",
      categoryLabel: "フォトスポット",
      stayMinutes: 25,
      defaultPriceLevel: 0,
    },
    { type: "art_gallery", categoryLabel: "ギャラリー", stayMinutes: 30, defaultPriceLevel: 1 },
  ],
};

const MAX_BUDGET_PRICE_LEVEL: Record<BudgetId, number> = {
  under2000: 1,
  under5000: 2,
  under10000: 3,
  any: 4,
};

interface GooglePlace {
  place_id: string;
  name: string;
  business_status?: string;
  price_level?: number;
  vicinity?: string;
  formatted_address?: string;
  rating?: number;
  geometry: { location: { lat: number; lng: number } };
}

async function geocodeArea(areaLabel: string): Promise<{ lat: number; lng: number } | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", areaLabel);
  url.searchParams.set("language", "ja");
  url.searchParams.set("region", "jp");
  url.searchParams.set("key", GOOGLE_MAPS_API_KEY!);

  const res = await fetch(url.toString());
  const data = await res.json();
  const first = data.results?.[0];
  if (!first) return null;
  return { lat: first.geometry.location.lat, lng: first.geometry.location.lng };
}

async function nearbySearch(
  origin: { lat: number; lng: number },
  query: MoodQuery
): Promise<GooglePlace[]> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  url.searchParams.set("location", `${origin.lat},${origin.lng}`);
  url.searchParams.set("radius", String(SEARCH_RADIUS_METERS));
  url.searchParams.set("type", query.type);
  if (query.keyword) url.searchParams.set("keyword", query.keyword);
  url.searchParams.set("language", "ja");
  url.searchParams.set("key", GOOGLE_MAPS_API_KEY!);

  const res = await fetch(url.toString());
  const data = await res.json();
  return (data.results ?? []) as GooglePlace[];
}

export async function GET(req: NextRequest) {
  if (!GOOGLE_MAPS_API_KEY) {
    return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY が設定されていません" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const areaLabel = searchParams.get("areaLabel");
  const mood = searchParams.get("mood") as MoodId | null;
  const budget = (searchParams.get("budget") as BudgetId | null) ?? "any";

  if (!areaLabel || !mood || !MOOD_QUERIES[mood]) {
    return NextResponse.json({ error: "areaLabel と mood は必須です" }, { status: 400 });
  }

  const origin = await geocodeArea(areaLabel);
  if (!origin) {
    return NextResponse.json({ error: `「${areaLabel}」の場所が見つかりませんでした` }, { status: 404 });
  }

  const queries = MOOD_QUERIES[mood];
  const resultsByQuery = await Promise.all(queries.map((q) => nearbySearch(origin, q)));

  const seen = new Set<string>();
  const spots: Spot[] = [];
  const maxPriceLevel = MAX_BUDGET_PRICE_LEVEL[budget];

  resultsByQuery.forEach((places, queryIndex) => {
    const query = queries[queryIndex];
    for (const place of places) {
      if (!place.place_id || seen.has(place.place_id)) continue;
      if (place.business_status && place.business_status !== "OPERATIONAL") continue;

      const priceLevel = place.price_level ?? query.defaultPriceLevel;
      if (priceLevel > maxPriceLevel) continue;

      seen.add(place.place_id);
      spots.push({
        id: place.place_id,
        name: place.name,
        category: query.categoryLabel,
        moods: [mood],
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
        stayMinutes: query.stayMinutes,
        priceLevel: Math.min(4, Math.max(0, priceLevel)) as Spot["priceLevel"],
        description: place.vicinity ?? place.formatted_address ?? "",
      });
    }
  });

  return NextResponse.json({ origin, spots });
}
