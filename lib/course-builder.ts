import { TRANSPORTS } from "./moods";
import { Course, CourseStop, LatLng, MealTiming, SearchParams, Spot } from "./types";

const MAX_STOPS_BY_PACE: Record<SearchParams["pace"], number> = {
  relaxed: 3,
  packed: 6,
};

const MEAL_CATEGORY_KEYWORDS = ["レストラン", "バー", "カフェ"];

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 2地点間の直線距離(km)。順路の仮決め（貪欲法の並び替え）にのみ使う近似値。 */
function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function estimateTravelMinutes(distanceKm: number, transportId: SearchParams["transport"]): number {
  const transport = TRANSPORTS.find((t) => t.id === transportId) ?? TRANSPORTS[0];
  return Math.round(((distanceKm / transport.speedKmh) * 60) * 1.3);
}

async function fetchSpots(params: SearchParams): Promise<{ origin: LatLng; spots: Spot[] }> {
  const query = new URLSearchParams({
    areaLabel: params.areaLabel,
    mood: params.mood,
    budget: params.budget,
    ageBracket: params.ageBracket,
    purpose: params.purpose,
    vibe: params.vibe,
    indoorOutdoor: params.indoorOutdoor,
    specialConditions: params.specialConditions.join(","),
    cuisine: params.cuisine,
  });

  const res = await fetch(`/api/spots?${query.toString()}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "スポット検索に失敗しました");
  }
  return data;
}

/** Directions APIで実移動時間(分)を取得。失敗時は直線距離からの概算にフォールバックする。 */
async function fetchLegMinutes(from: LatLng, to: LatLng, transport: SearchParams["transport"]): Promise<number> {
  try {
    const query = new URLSearchParams({
      originLat: String(from.lat),
      originLng: String(from.lng),
      destLat: String(to.lat),
      destLng: String(to.lng),
      transport,
    });

    const res = await fetch(`/api/directions?${query.toString()}`);
    if (!res.ok) throw new Error("directions failed");
    const data = await res.json();
    return data.durationMinutes as number;
  } catch {
    return estimateTravelMinutes(haversineDistanceKm(from, to), transport);
  }
}

/**
 * origin から出発し、直線距離ベースの貪欲法で訪問順を仮決めする（API呼び出しなし・高速）。
 * 実移動時間は後段の refineWithRealDurations で置き換える。ペースに応じて訪問数の上限を変える。
 */
function pickGreedyOrder(
  origin: LatLng,
  candidates: Spot[],
  skipFirstNearest: boolean,
  maxStops: number
): Spot[] {
  const remaining = [...candidates];
  const order: Spot[] = [];
  let currentPos: LatLng = origin;
  let firstPick = true;

  while (remaining.length > 0 && order.length < maxStops) {
    remaining.sort((a, b) => haversineDistanceKm(currentPos, a) - haversineDistanceKm(currentPos, b));
    const pickIndex = firstPick && skipFirstNearest && remaining.length > 1 ? 1 : 0;
    const next = remaining[pickIndex];

    order.push(next);
    currentPos = next;
    remaining.splice(pickIndex, 1);
    firstPick = false;
  }

  return order;
}

function isMealSpot(spot: Spot): boolean {
  return MEAL_CATEGORY_KEYWORDS.some((keyword) => spot.category.includes(keyword));
}

/**
 * 食事を挟むタイミングの希望に沿って訪問順を並び替える。
 * 現状は選択中のmoodで取得済みのスポットの中でしか並び替えできない
 * （カフェ/レストラン/バー以外のmoodでは食事系スポット自体が候補に無いため効果が薄い）。
 */
function applyMealTiming(order: Spot[], mealTiming: MealTiming): Spot[] {
  if (mealTiming === "any") return order;

  const mealSpots = order.filter(isMealSpot);
  const otherSpots = order.filter((s) => !isMealSpot(s));

  if (mealTiming === "none") return otherSpots;
  if (mealTiming === "first_half") return [...mealSpots, ...otherSpots];
  return [...otherSpots, ...mealSpots]; // second_half
}

/** 仮決めした訪問順に沿って実移動時間を取得し、時間予算を超える手前で打ち切る。 */
async function refineWithRealDurations(
  origin: LatLng,
  order: Spot[],
  params: SearchParams
): Promise<CourseStop[]> {
  const stops: CourseStop[] = [];
  let currentPos: LatLng = origin;
  let elapsedMinutes = 0;

  for (const spot of order) {
    const travel = await fetchLegMinutes(currentPos, spot, params.transport);
    const arrival = elapsedMinutes + travel;
    const departure = arrival + spot.stayMinutes;

    if (departure > params.durationMinutes) break;

    stops.push({
      spot,
      travelMinutesFromPrevious: travel,
      arrivalOffsetMinutes: arrival,
      departureOffsetMinutes: departure,
      // 季節イベント/お得情報の実データ紐付けは未実装(実店舗IDに対応するキュレーション基盤が必要)
      events: [],
    });

    elapsedMinutes = departure;
    currentPos = spot;
  }

  return stops;
}

export async function buildCourses(params: SearchParams): Promise<Course[]> {
  const { origin, spots } = await fetchSpots(params);

  if (spots.length === 0) return [];

  const maxStops = MAX_STOPS_BY_PACE[params.pace];
  const mainOrder = applyMealTiming(pickGreedyOrder(origin, spots, false, maxStops), params.mealTiming);
  const altOrder = applyMealTiming(pickGreedyOrder(origin, spots, true, maxStops), params.mealTiming);

  const [mainStops, altStops] = await Promise.all([
    refineWithRealDurations(origin, mainOrder, params),
    refineWithRealDurations(origin, altOrder, params),
  ]);

  const courses: Course[] = [
    {
      id: "course-main",
      title: "王道コース",
      tag: "定番",
      totalMinutes: mainStops.at(-1)?.departureOffsetMinutes ?? 0,
      origin,
      stops: mainStops,
    },
  ];

  const isDifferentFromMain =
    altStops.length > 0 &&
    altStops.map((s) => s.spot.id).join(",") !== mainStops.map((s) => s.spot.id).join(",");

  if (isDifferentFromMain) {
    courses.push({
      id: "course-alt",
      title: "穴場コース",
      tag: "少しディープ",
      totalMinutes: altStops.at(-1)?.departureOffsetMinutes ?? 0,
      origin,
      stops: altStops,
    });
  }

  return courses.filter((course) => course.stops.length > 0);
}
