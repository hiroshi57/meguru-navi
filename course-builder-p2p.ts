/**
 * lib/course-builder-p2p.ts
 *
 * 目的地指定時の「起点→スポット→…→目的地」一方向コース生成。
 * 既存の周回コース生成（lib/course-builder.ts の pickGreedyOrder + refineWithRealDurations）
 * とは別関数として提供し、目的地なしの既存動作には影響しない。
 *
 * 既存 Course / CourseStop 型をそのまま返すため、CourseCard 側の改修は
 * 「destination / finalLegMinutes の表示追加」のみで済む。
 *
 * 呼び出し例（lib/course-builder.ts 側）:
 *
 *   if (params.destLabel) {
 *     // /api/spots?destLabel=... のレスポンス（origin, destination, routePolyline, spots）を使う
 *     const course = await buildPointToPointCourse({
 *       id: "ohdou",
 *       title: "王道コース",
 *       tag: "起点から順に巡る",
 *       origin: data.origin,
 *       destination: data.destination,
 *       spots: data.spots,                    // routeProgress昇順でソート済み
 *       routePolyline: data.routePolyline,
 *       maxStops: calcMaxStops(params.pace, params.durationMinutes),  // 既存関数を再利用
 *       budgetMinutes: params.durationMinutes,
 *       transportSpeedKmh: TRANSPORTS.find(t => t.id === params.transport)!.speedKmh,
 *       getLegMinutes: (from, to) => fetchDirectionsMinutes(from, to, params.transport), // 既存の/api/directions呼び出し
 *     });
 *   }
 */

import { Course, CourseStop, LatLng, Spot } from "./types";
import { haversineDistanceMeters } from "./route-corridor";

export interface BuildPointToPointCourseParams {
  id: string;
  title: string;
  tag: string;
  origin: LatLng;
  destination: LatLng;
  /** routeProgress昇順（起点→目的地の順）でソート済みのスポット候補 */
  spots: Spot[];
  maxStops: number;
  /** 使える時間（滞在込み合計, 分）。既存の durationMinutes と同じ意味 */
  budgetMinutes: number;
  /** Directions失敗時の概算に使う移動速度（既存のTRANSPORTS.speedKmhを渡す） */
  transportSpeedKmh: number;
  /** 2点間の実移動時間(分)を取得する。既存の /api/directions 呼び出しロジックを注入する */
  getLegMinutes: (from: LatLng, to: LatLng) => Promise<number>;
  /**
   * 候補の選び方のオフセット。0=起点寄りの候補から敷き詰める（王道）、
   * 1=半歩ずらして選ぶ（穴場）。周回コースの「起点選択を変えて多様性を出す」方針の一方向版。
   */
  pickOffset?: 0 | 1;
}

/** Directions失敗時の概算。既存方針（直線距離×1.3の補正）を踏襲。 */
function estimateLegMinutes(from: LatLng, to: LatLng, speedKmh: number): number {
  const meters = haversineDistanceMeters(from, to) * 1.3;
  const metersPerMinute = (speedKmh * 1000) / 60;
  return meters / metersPerMinute;
}

async function getLegMinutesSafe(
  from: LatLng,
  to: LatLng,
  params: BuildPointToPointCourseParams
): Promise<number> {
  try {
    return await params.getLegMinutes(from, to);
  } catch (err) {
    console.warn("Directions呼び出し失敗。直線距離からの概算にフォールバック:", err);
    return estimateLegMinutes(from, to, params.transportSpeedKmh);
  }
}

/**
 * 起点→スポット→…→目的地の一方向コースを組み立てる。
 *
 * 周回コースとの方針の違い:
 * - 訪問順は貪欲法ではなく routeProgress（ルート上の進行度）順で確定
 * - 「目的地まで時間内に到達すること」が確定要件のため、各スポット追加前に
 *   「そのスポットから目的地までの残り移動時間（概算）」も含めて予算超過を判定する
 * - 予算を超えるスポットはスキップして次の候補を試す（打ち切りではなく間引き）
 * - 起点付近にスポットが固まらないよう、直前に採用したスポットから
 *   「全行程をmaxStops分割した幅の半分」以上の進行度間隔を要求する
 *
 * 訪問できるスポットが1件も無い場合は null を返す（呼び出し側でエラー表示）。
 */
export async function buildPointToPointCourse(
  params: BuildPointToPointCourseParams
): Promise<Course | null> {
  const { origin, destination, maxStops, budgetMinutes } = params;

  // 経路全域にスポットを分散させるための最低進行度間隔
  const minProgressGap = (1 / Math.max(1, maxStops)) * 0.5;
  // 穴場コース(pickOffset=1)は走査開始位置を半区間ずらし、王道と構成を変える
  let minNextProgress = (params.pickOffset ?? 0) === 1 ? minProgressGap : 0;

  const stops: CourseStop[] = [];
  let cumulativeMinutes = 0;
  let currentPoint: LatLng = origin;

  for (const spot of params.spots) {
    if (stops.length >= maxStops) break;

    const progress = spot.routeProgress ?? 0;
    if (progress < minNextProgress) continue;

    const spotPoint: LatLng = { lat: spot.lat, lng: spot.lng };
    const legMinutes = await getLegMinutesSafe(currentPoint, spotPoint, params);
    const arrivalOffset = cumulativeMinutes + legMinutes;
    const departureOffset = arrivalOffset + spot.stayMinutes;

    // このスポットに寄った後、目的地まで時間内に着けるかを概算でチェック
    const remainingToDestination = estimateLegMinutes(spotPoint, destination, params.transportSpeedKmh);
    if (departureOffset + remainingToDestination > budgetMinutes) {
      continue; // 予算超過するスポットはスキップして次の候補へ
    }

    stops.push({
      spot,
      travelMinutesFromPrevious: Math.round(legMinutes),
      arrivalOffsetMinutes: Math.round(arrivalOffset),
      departureOffsetMinutes: Math.round(departureOffset),
      events: [], // 季節イベント機能は保留中（CLAUDE.md準拠）
    });
    cumulativeMinutes = departureOffset;
    currentPoint = spotPoint;
    minNextProgress = progress + minProgressGap;
  }

  if (stops.length === 0) return null;

  const finalLegMinutes = await getLegMinutesSafe(currentPoint, destination, params);
  const totalMinutes = Math.round(cumulativeMinutes + finalLegMinutes);

  return {
    id: params.id,
    title: params.title,
    tag: params.tag,
    totalMinutes,
    origin,
    destination,
    finalLegMinutes: Math.round(finalLegMinutes),
    stops,
  };
}

/**
 * 王道・穴場の2コースを生成する（周回コースの2パターン出しと同等のインターフェース）。
 * 穴場コースは、王道コースで使ったスポットを除外した候補プールから作る
 * （既存の「穴場コースの重複防止」方針を踏襲。候補が尽きた場合は穴場を出さない）。
 */
export async function buildPointToPointCourses(
  base: Omit<BuildPointToPointCourseParams, "id" | "title" | "tag" | "pickOffset">
): Promise<Course[]> {
  const courses: Course[] = [];

  const ohdou = await buildPointToPointCourse({
    ...base,
    id: "p2p-ohdou",
    title: "王道コース",
    tag: "経路沿いの人気どころ",
    pickOffset: 0,
  });
  if (ohdou) courses.push(ohdou);

  const usedIds = new Set(ohdou?.stops.map((s) => s.spot.id) ?? []);
  const remaining = base.spots.filter((s) => !usedIds.has(s.id));

  if (remaining.length > 0) {
    const anaba = await buildPointToPointCourse({
      ...base,
      spots: remaining,
      id: "p2p-anaba",
      title: "穴場コース",
      tag: "ちょっと寄り道",
      pickOffset: 1,
    });
    if (anaba) courses.push(anaba);
  }

  return courses;
}
