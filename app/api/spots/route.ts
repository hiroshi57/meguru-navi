import { NextRequest, NextResponse } from "next/server";
import {
  AgeBracket,
  BudgetId,
  Cuisine,
  IndoorOutdoor,
  MoodId,
  Purpose,
  SpecialCondition,
  Spot,
  Vibe,
} from "@/lib/types";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const SEARCH_RADIUS_METERS = 1500;
/** 賑やかさの目安。1=静か 〜 5=大人数向け・ハイテンション。除外ルールの判定に使う。 */
type EnergyLevel = 1 | 2 | 3 | 4 | 5;

interface MoodQuery {
  type: string;
  keyword?: string;
  categoryLabel: string;
  stayMinutes: number;
  defaultPriceLevel: number;
  indoor: boolean;
  energyLevel: EnergyLevel;
  alcohol: boolean;
  kidFriendly: boolean;
}

const MOOD_QUERIES: Record<MoodId, MoodQuery[]> = {
  mattari: [
    { type: "park", categoryLabel: "公園", stayMinutes: 40, defaultPriceLevel: 0, indoor: false, energyLevel: 1, alcohol: false, kidFriendly: true },
    { type: "cafe", categoryLabel: "カフェ", stayMinutes: 30, defaultPriceLevel: 1, indoor: true, energyLevel: 2, alcohol: false, kidFriendly: true },
  ],
  gourmet: [
    { type: "restaurant", categoryLabel: "レストラン", stayMinutes: 50, defaultPriceLevel: 2, indoor: true, energyLevel: 2, alcohol: false, kidFriendly: true },
    { type: "bar", categoryLabel: "バー", stayMinutes: 45, defaultPriceLevel: 2, indoor: true, energyLevel: 4, alcohol: true, kidFriendly: false },
  ],
  active: [
    { type: "tourist_attraction", categoryLabel: "観光名所", stayMinutes: 40, defaultPriceLevel: 1, indoor: false, energyLevel: 3, alcohol: false, kidFriendly: true },
    { type: "gym", categoryLabel: "アクティビティ施設", stayMinutes: 60, defaultPriceLevel: 2, indoor: true, energyLevel: 4, alcohol: false, kidFriendly: false },
  ],
  photo: [
    { type: "tourist_attraction", keyword: "フォトスポット", categoryLabel: "フォトスポット", stayMinutes: 25, defaultPriceLevel: 0, indoor: false, energyLevel: 2, alcohol: false, kidFriendly: true },
    { type: "art_gallery", categoryLabel: "ギャラリー", stayMinutes: 30, defaultPriceLevel: 1, indoor: true, energyLevel: 1, alcohol: false, kidFriendly: true },
  ],
};

const MAX_BUDGET_PRICE_LEVEL: Record<BudgetId, number> = {
  under2000: 1,
  under5000: 2,
  under10000: 3,
  any: 4,
};

const PURPOSE_KEYWORDS: Record<Purpose, string> = {
  sightseeing: "観光",
  couple: "デート",
  family: "子連れ 家族",
  friends: "友人 グループ",
  solo: "一人",
};

const VIBE_KEYWORDS: Record<Vibe, string> = {
  calm: "落ち着いた 隠れ家",
  lively: "人気 賑わい",
};

const SPECIAL_CONDITION_KEYWORDS: Record<SpecialCondition, string> = {
  no_stairs: "バリアフリー",
  no_alcohol: "ノンアルコール",
  no_smoking: "禁煙",
  pet_friendly: "ペット可",
};

/** ラーメン/洋食/そばは「restaurant」タイプのkeywordを差し替えて絞り込む。 */
const CUISINE_QUERY_OVERRIDE: Partial<Record<Cuisine, { keyword: string; categoryLabel: string }>> = {
  ramen: { keyword: "ラーメン", categoryLabel: "ラーメン" },
  western: { keyword: "洋食", categoryLabel: "洋食" },
  soba: { keyword: "そば", categoryLabel: "そば" },
};

interface FilterParams {
  ageBracket: AgeBracket;
  purpose: Purpose;
  vibe: Vibe;
  indoorOutdoor: IndoorOutdoor;
  specialConditions: SpecialCondition[];
  cuisine: Cuisine;
}

/**
 * 目的・年代・雰囲気・屋内外・こだわり条件をもとに、検索候補(type)の絞り込みとキーワード補正を行う。
 * Google Places側に段差・喫煙可否等の信頼できる属性が無いため、除外は「酒類提供」等の明確な軸のみハードに行い、
 * それ以外（バリアフリー・禁煙等）はキーワードでの重み付けに留める（ベストエフォート）。
 */
function buildEffectiveQueries(mood: MoodId, filters: FilterParams): MoodQuery[] {
  const base = MOOD_QUERIES[mood];

  const maxEnergyForCombo = (() => {
    // 「50代以上」×「友人とワイワイ」以外は、酒場・カラオケ的な高テンション施設を避ける
    if (filters.ageBracket === "50s_plus" && filters.purpose !== "friends") return 3;
    if (filters.purpose === "solo") return 3;
    if (filters.purpose === "couple") return 3;
    if (filters.vibe === "calm") return 3;
    return 5;
  })();

  let filtered = base.filter((q) => {
    if (q.energyLevel > maxEnergyForCombo) return false;
    if (filters.purpose === "family" && (q.alcohol || !q.kidFriendly)) return false;
    if (filters.specialConditions.includes("no_alcohol") && q.alcohol) return false;
    if (filters.indoorOutdoor === "indoor" && !q.indoor) return false;
    if (filters.indoorOutdoor === "outdoor" && q.indoor) return false;
    return true;
  });

  // 絞り込みすぎて候補が消える場合は、そのmoodの基本候補にフォールバックする
  if (filtered.length === 0) filtered = base;

  const extraKeywords = [
    PURPOSE_KEYWORDS[filters.purpose],
    VIBE_KEYWORDS[filters.vibe],
    ...filters.specialConditions.map((c) => SPECIAL_CONDITION_KEYWORDS[c]),
  ];

  const cuisineOverride = CUISINE_QUERY_OVERRIDE[filters.cuisine];

  return filtered.map((q) => {
    const applyCuisine = cuisineOverride && q.type === "restaurant";
    return {
      ...q,
      categoryLabel: applyCuisine ? cuisineOverride.categoryLabel : q.categoryLabel,
      keyword: [applyCuisine ? cuisineOverride.keyword : q.keyword, ...extraKeywords].filter(Boolean).join(" "),
    };
  });
}

interface GooglePlace {
  place_id: string;
  name: string;
  business_status?: string;
  price_level?: number;
  vicinity?: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  photos?: { photo_reference: string }[];
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

function parseSpecialConditions(raw: string | null): SpecialCondition[] {
  if (!raw) return [];
  const valid: SpecialCondition[] = ["no_stairs", "no_alcohol", "no_smoking", "pet_friendly"];
  return raw.split(",").filter((v): v is SpecialCondition => (valid as string[]).includes(v));
}

export async function GET(req: NextRequest) {
  if (!GOOGLE_MAPS_API_KEY) {
    return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY が設定されていません" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const areaLabel = searchParams.get("areaLabel");
  const mood = searchParams.get("mood") as MoodId | null;
  const budget = (searchParams.get("budget") as BudgetId | null) ?? "any";
  const ageBracket = (searchParams.get("ageBracket") as AgeBracket | null) ?? "30s";
  const purpose = (searchParams.get("purpose") as Purpose | null) ?? "sightseeing";
  const vibe = (searchParams.get("vibe") as Vibe | null) ?? "calm";
  const indoorOutdoor = (searchParams.get("indoorOutdoor") as IndoorOutdoor | null) ?? "either";
  const specialConditions = parseSpecialConditions(searchParams.get("specialConditions"));
  const cuisine = (searchParams.get("cuisine") as Cuisine | null) ?? "any";

  if (!areaLabel || !mood || !MOOD_QUERIES[mood]) {
    return NextResponse.json({ error: "areaLabel と mood は必須です" }, { status: 400 });
  }

  const origin = await geocodeArea(areaLabel);
  if (!origin) {
    return NextResponse.json({ error: `「${areaLabel}」の場所が見つかりませんでした` }, { status: 404 });
  }

  const queries = buildEffectiveQueries(mood, { ageBracket, purpose, vibe, indoorOutdoor, specialConditions, cuisine });
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
        photoRef: place.photos?.[0]?.photo_reference,
        rating: place.rating,
        userRatingsTotal: place.user_ratings_total,
      });
    }
  });

  return NextResponse.json({ origin, spots });
}
