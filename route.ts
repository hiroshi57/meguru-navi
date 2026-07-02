import { NextRequest, NextResponse } from "next/server";
import { TRANSPORTS } from "@/lib/moods";
import {
  AgeBracket,
  BudgetId,
  Cuisine,
  IndoorOutdoor,
  LatLng,
  MoodId,
  Purpose,
  SpecialCondition,
  Spot,
  TransportId,
  Vibe,
} from "@/lib/types";
import {
  buildCorridorSearchPoints,
  decodeRoute,
  routeFromPath,
  DecodedRoute,
} from "@/lib/route-corridor";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const DEFAULT_SEARCH_RADIUS_METERS = 1500;
const MIN_SEARCH_RADIUS_METERS = 800;
const MAX_SEARCH_RADIUS_METERS = 15000;
/** 使える時間のうち、実際に「拠点から離れる」ことに使える割合の目安（往復・複数スポット訪問を考慮） */
const RADIUS_TIME_FRACTION = 0.25;
/** 経路沿い検索のサンプル点数上限。API呼び出し数 = サンプル点数 × mood別クエリ数 になるためコスト上限として制御する。 */
const MAX_CORRIDOR_SAMPLE_POINTS = 5;
/** 賑やかさの目安。1=静か 〜 5=大人数向け・ハイテンション。除外ルールの判定に使う。 */
type EnergyLevel = 1 | 2 | 3 | 4 | 5;

/** TransportId → Directions API の mode パラメータへの変換。 */
const DIRECTIONS_MODE: Record<TransportId, string> = {
  walk: "walking",
  bike: "bicycling",
  train: "transit",
  car: "driving",
};

/**
 * 使える時間と移動手段から検索半径(m)を見積もる。
 * 「半日・1日」等の長時間コースでは固定1.5km圏内では狭すぎるため、
 * 移動手段の速度 × 時間 × 割合 で拠点からの実質行動範囲を概算し、半径として使う。
 */
function calcSearchRadiusMeters(durationMinutes: number | null, transportId: TransportId | null): number {
  if (!durationMinutes || !transportId) return DEFAULT_SEARCH_RADIUS_METERS;
  const transport = TRANSPORTS.find((t) => t.id === transportId);
  if (!transport) return DEFAULT_SEARCH_RADIUS_METERS;

  const raw = transport.speedKmh * (durationMinutes / 60) * 1000 * RADIUS_TIME_FRACTION;
  return Math.min(MAX_SEARCH_RADIUS_METERS, Math.max(MIN_SEARCH_RADIUS_METERS, Math.round(raw)));
}

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

/**
 * こだわり条件のうち検索keywordに載せるもの。pet_friendlyは意図的に含めない
 * （「ペット可」を強調すると検索結果がペット専門施設に偏るため。除外はせず条件としてのみ保持する）。
 */
const SPECIAL_CONDITION_KEYWORDS: Partial<Record<SpecialCondition, string>> = {
  no_stairs: "バリアフリー",
  no_alcohol: "ノンアルコール",
  no_smoking: "禁煙",
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
  query: MoodQuery,
  radiusMeters: number
): Promise<GooglePlace[]> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  url.searchParams.set("location", `${origin.lat},${origin.lng}`);
  url.searchParams.set("radius", String(radiusMeters));
  url.searchParams.set("type", query.type);
  if (query.keyword) url.searchParams.set("keyword", query.keyword);
  url.searchParams.set("language", "ja");
  url.searchParams.set("key", GOOGLE_MAPS_API_KEY!);

  const res = await fetch(url.toString());
  const data = await res.json();
  return (data.results ?? []) as GooglePlace[];
}

/**
 * Directions APIで起点→目的地の経路を取得し、デコード済みルートとポリライン文字列を返す。
 * 取得に失敗した場合は起点・目的地を直線で結んだ簡易ルートにフォールバックし、
 * 経路沿い検索自体は止めない（既存のDirections失敗時フォールバック方針を踏襲）。
 */
async function fetchRouteForCorridor(
  origin: LatLng,
  destination: LatLng,
  transport: TransportId
): Promise<{ route: DecodedRoute; polyline: string | null }> {
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.set("origin", `${origin.lat},${origin.lng}`);
    url.searchParams.set("destination", `${destination.lat},${destination.lng}`);
    url.searchParams.set("mode", DIRECTIONS_MODE[transport]);
    url.searchParams.set("language", "ja");
    url.searchParams.set("region", "jp");
    url.searchParams.set("key", GOOGLE_MAPS_API_KEY!);

    const res = await fetch(url.toString());
    const data = await res.json();
    const polyline: string | undefined = data.routes?.[0]?.overview_polyline?.points;
    if (data.status === "OK" && polyline) {
      return { route: decodeRoute(polyline), polyline };
    }
  } catch (err) {
    console.warn("Directions API(経路沿い検索用)の呼び出しに失敗。直線ルートにフォールバック:", err);
  }
  return { route: routeFromPath([origin, destination]), polyline: null };
}

/**
 * GooglePlaceの配列からSpotへの変換＋重複排除＋予算フィルタ。
 * 従来の周回検索・経路沿い検索の両方から使う共通処理。
 * routeProgressByEntry が渡された場合（経路沿い検索）、Spotに進行度を付与する。
 * 同一place_idが複数の検索ポイントでヒットした場合は、起点に近い（小さい）進行度を採用する。
 */
function collectSpots(
  entries: Array<{ places: GooglePlace[]; query: MoodQuery; routeProgress?: number }>,
  mood: MoodId,
  maxPriceLevel: number
): Spot[] {
  const spotById = new Map<string, Spot>();

  for (const { places, query, routeProgress } of entries) {
    for (const place of places) {
      if (!place.place_id) continue;
      if (place.business_status && place.business_status !== "OPERATIONAL") continue;

      const existing = spotById.get(place.place_id);
      if (existing) {
        // 経路沿い検索: より起点に近い進行度を採用
        if (
          routeProgress !== undefined &&
          (existing.routeProgress === undefined || routeProgress < existing.routeProgress)
        ) {
          existing.routeProgress = routeProgress;
        }
        continue;
      }

      const priceLevel = place.price_level ?? query.defaultPriceLevel;
      if (priceLevel > maxPriceLevel) continue;

      spotById.set(place.place_id, {
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
        routeProgress,
      });
    }
  }

  return Array.from(spotById.values());
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
  const destLabel = searchParams.get("destLabel");
  const mood = searchParams.get("mood") as MoodId | null;
  const budget = (searchParams.get("budget") as BudgetId | null) ?? "any";
  const ageBracket = (searchParams.get("ageBracket") as AgeBracket | null) ?? "30s";
  const purpose = (searchParams.get("purpose") as Purpose | null) ?? "sightseeing";
  const vibe = (searchParams.get("vibe") as Vibe | null) ?? "calm";
  const indoorOutdoor = (searchParams.get("indoorOutdoor") as IndoorOutdoor | null) ?? "either";
  const specialConditions = parseSpecialConditions(searchParams.get("specialConditions"));
  const cuisine = (searchParams.get("cuisine") as Cuisine | null) ?? "any";
  const transport = searchParams.get("transport") as TransportId | null;
  const durationMinutes = searchParams.get("durationMinutes")
    ? Number(searchParams.get("durationMinutes"))
    : null;

  if (!areaLabel || !mood || !MOOD_QUERIES[mood]) {
    return NextResponse.json({ error: "areaLabel と mood は必須です" }, { status: 400 });
  }

  const origin = await geocodeArea(areaLabel);
  if (!origin) {
    return NextResponse.json({ error: `「${areaLabel}」の場所が見つかりませんでした` }, { status: 404 });
  }

  const queries = buildEffectiveQueries(mood, { ageBracket, purpose, vibe, indoorOutdoor, specialConditions, cuisine });
  const maxPriceLevel = MAX_BUDGET_PRICE_LEVEL[budget];

  // ── 経路沿い検索（起点→目的地の一方向コース用）──────────────────────
  if (destLabel) {
    const destination = await geocodeArea(destLabel);
    if (!destination) {
      return NextResponse.json({ error: `「${destLabel}」の場所が見つかりませんでした` }, { status: 404 });
    }

    const effectiveTransport = transport ?? "walk";
    const { route, polyline } = await fetchRouteForCorridor(origin, destination, effectiveTransport);
    const searchPoints = buildCorridorSearchPoints(route, effectiveTransport, MAX_CORRIDOR_SAMPLE_POINTS);

    // 検索ポイント × mood別クエリ の全組み合わせを並行実行
    const entries = await Promise.all(
      searchPoints.flatMap((sp) =>
        queries.map(async (q) => ({
          places: await nearbySearch(sp.point, q, sp.radiusMeters),
          query: q,
          routeProgress: sp.routeProgress,
        }))
      )
    );

    const spots = collectSpots(entries, mood, maxPriceLevel)
      // 起点→目的地の進行度順に並べておく（コース生成側の一方向順決定に使う）
      .sort((a, b) => (a.routeProgress ?? 0) - (b.routeProgress ?? 0));

    return NextResponse.json({ origin, destination, routePolyline: polyline, spots });
  }

  // ── 従来の周回検索（起点1点からの半径検索）──────────────────────────
  const radiusMeters = calcSearchRadiusMeters(durationMinutes, transport);
  const resultsByQuery = await Promise.all(queries.map((q) => nearbySearch(origin, q, radiusMeters)));

  const spots = collectSpots(
    resultsByQuery.map((places, i) => ({ places, query: queries[i] })),
    mood,
    maxPriceLevel
  );

  return NextResponse.json({ origin, spots });
}
