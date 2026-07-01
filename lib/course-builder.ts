import { TRANSPORTS } from "./moods";
import { MOCK_EVENTS, isEventActive } from "./mock-events";
import { MOCK_SPOTS } from "./mock-spots";
import { BudgetId, Course, CourseStop, SearchParams, Spot } from "./types";

const MAX_STOPS_PER_COURSE = 5;
const MAX_BUDGET_PRICE_LEVEL: Record<BudgetId, number> = {
  under2000: 1,
  under5000: 2,
  under10000: 3,
  any: 4,
};

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 2地点間の直線距離(km)。Directions API 未接続の間はこれを移動時間の近似に使う。 */
function haversineDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function travelMinutes(distanceKm: number, transportId: SearchParams["transport"]): number {
  const transport = TRANSPORTS.find((t) => t.id === transportId) ?? TRANSPORTS[0];
  // 実移動時間は信号待ち・乗換等で直線距離より伸びるため 1.3 倍の補正をかける
  return Math.round(((distanceKm / transport.speedKmh) * 60) * 1.3);
}

function matchesBudget(priceLevel: number, budget: BudgetId): boolean {
  return priceLevel <= MAX_BUDGET_PRICE_LEVEL[budget];
}

function eventsForSpot(spotId: string, today: Date) {
  return MOCK_EVENTS.filter((event) => event.spotId === spotId && isEventActive(event, today));
}

/**
 * origin から出発し、時間内に収まる範囲で最寄りの候補地を貪欲に選び続けて1本のコースを作る。
 * TSP の厳密解ではないが、候補地が数件〜十数件程度の規模では十分実用的なルートになる。
 */
function buildGreedyCourse(
  origin: { lat: number; lng: number },
  candidates: Spot[],
  params: SearchParams,
  skipFirstNearest: boolean
): CourseStop[] {
  const remaining = [...candidates];
  const stops: CourseStop[] = [];
  let currentPos = origin;
  let elapsedMinutes = 0;
  let firstPick = true;

  while (remaining.length > 0 && stops.length < MAX_STOPS_PER_COURSE) {
    remaining.sort(
      (a, b) => haversineDistanceKm(currentPos, a) - haversineDistanceKm(currentPos, b)
    );

    const pickIndex = firstPick && skipFirstNearest && remaining.length > 1 ? 1 : 0;
    const next = remaining[pickIndex];
    const distanceKm = haversineDistanceKm(currentPos, next);
    const travel = travelMinutes(distanceKm, params.transport);
    const projectedElapsed = elapsedMinutes + travel + next.stayMinutes;

    if (projectedElapsed > params.durationMinutes) {
      remaining.splice(pickIndex, 1);
      firstPick = false;
      continue;
    }

    stops.push({
      spot: next,
      travelMinutesFromPrevious: travel,
      arrivalOffsetMinutes: elapsedMinutes + travel,
      departureOffsetMinutes: projectedElapsed,
      events: eventsForSpot(next.id, new Date()),
    });

    elapsedMinutes = projectedElapsed;
    currentPos = next;
    remaining.splice(pickIndex, 1);
    firstPick = false;
  }

  return stops;
}

function courseCentroid(spots: Spot[]): { lat: number; lng: number } {
  const lat = spots.reduce((sum, s) => sum + s.lat, 0) / spots.length;
  const lng = spots.reduce((sum, s) => sum + s.lng, 0) / spots.length;
  return { lat, lng };
}

export function buildCourses(params: SearchParams): Course[] {
  let candidates = MOCK_SPOTS.filter(
    (spot) => spot.moods.includes(params.mood) && matchesBudget(spot.priceLevel, params.budget)
  );

  // 条件が絞りすぎて候補が少なすぎる場合は気分フィルタを緩めてフォールバックする
  if (candidates.length < 3) {
    candidates = MOCK_SPOTS.filter((spot) => matchesBudget(spot.priceLevel, params.budget));
  }

  const origin = courseCentroid(candidates);

  const mainStops = buildGreedyCourse(origin, candidates, params, false);
  const altStops = buildGreedyCourse(origin, candidates, params, true);

  const courses: Course[] = [
    {
      id: "course-main",
      title: "王道コース",
      tag: "定番",
      totalMinutes: mainStops.at(-1)?.departureOffsetMinutes ?? 0,
      stops: mainStops,
    },
  ];

  const isDifferentFromMain =
    altStops.length > 0 && altStops.map((s) => s.spot.id).join(",") !== mainStops.map((s) => s.spot.id).join(",");

  if (isDifferentFromMain) {
    courses.push({
      id: "course-alt",
      title: "穴場コース",
      tag: "少しディープ",
      totalMinutes: altStops.at(-1)?.departureOffsetMinutes ?? 0,
      stops: altStops,
    });
  }

  return courses.filter((course) => course.stops.length > 0);
}
