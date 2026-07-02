/**
 * lib/route-corridor.ts
 *
 * 「起点→目的地」指定時に、Directions APIで得た経路(ポリライン)沿いで
 * スポットを検索するための中核ロジック。
 * - decodePolyline: Googleのエンコード済みポリラインをデコード
 * - buildCorridorSearchPoints: ルート沿いに等間隔の検索ポイント(中心+半径)を生成
 *
 * 使用箇所: app/api/spots/route.ts（destLabel指定時の経路沿い検索）
 */

import { LatLng, TransportId } from "./types";

export interface CorridorSearchPoint {
  point: LatLng;
  /** 起点=0, 目的地=1 としたときの、ルート上のおおよその進行度 */
  routeProgress: number;
  /** このポイントを中心に検索する半径(m) */
  radiusMeters: number;
}

export interface DecodedRoute {
  path: LatLng[];
  totalDistanceMeters: number;
}

/**
 * Google の Encoded Polyline Algorithm Format をデコードする。
 * 外部ライブラリを追加せず自前実装。Directions API の overview_polyline.points を渡す。
 */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 1;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 1;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat * 1e-5, lng: lng * 1e-5 });
  }

  return points;
}

export function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function routeFromPath(path: LatLng[]): DecodedRoute {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += haversineDistanceMeters(path[i - 1], path[i]);
  }
  return { path, totalDistanceMeters: total };
}

export function decodeRoute(overviewPolyline: string): DecodedRoute {
  return routeFromPath(decodePolyline(overviewPolyline));
}

/**
 * 移動手段ごとの「経路から少し逸れて寄れる」感覚に合わせた corridor 半径。
 * 徒歩は狭め、電車・車は駅や駐車場から歩く前提で広めにする。
 */
export function corridorRadiusMeters(transport: TransportId): number {
  switch (transport) {
    case "walk":
      return 400;
    case "bike":
      return 600;
    case "train":
      return 800;
    case "car":
      return 1000;
  }
}

/**
 * ルート沿いに等間隔でサンプリングし、各サンプル点でNearby Searchをかけるための
 * 検索ポイント群を作る。
 *
 * API呼び出し数 = サンプル点数 × mood別クエリ数 になるため、
 * maxSamplePoints でコスト上限を制御する（既定5）。
 */
export function buildCorridorSearchPoints(
  route: DecodedRoute,
  transport: TransportId,
  maxSamplePoints = 5
): CorridorSearchPoint[] {
  const { path, totalDistanceMeters } = route;
  if (path.length === 0) return [];

  const radiusMeters = corridorRadiusMeters(transport);

  if (totalDistanceMeters === 0 || path.length === 1) {
    return [{ point: path[0], routeProgress: 0, radiusMeters }];
  }

  // 検索円が重複しすぎないよう、半径の1.5倍を目安間隔にする
  const idealIntervalMeters = radiusMeters * 1.5;
  const sampleCountByDistance = Math.ceil(totalDistanceMeters / idealIntervalMeters) + 1;
  const sampleCount = Math.max(2, Math.min(maxSamplePoints, sampleCountByDistance));

  const results: CorridorSearchPoint[] = [];
  let segmentIndex = 0;
  let accumulated = 0;
  let segmentLength = haversineDistanceMeters(path[0], path[1]);

  for (let i = 0; i < sampleCount; i++) {
    const targetProgress = i / (sampleCount - 1); // 0 〜 1
    const targetDistance = targetProgress * totalDistanceMeters;

    // targetDistance に到達するまでセグメントを進める
    while (segmentIndex < path.length - 2 && accumulated + segmentLength < targetDistance) {
      accumulated += segmentLength;
      segmentIndex++;
      segmentLength = haversineDistanceMeters(path[segmentIndex], path[segmentIndex + 1]);
    }

    const remaining = targetDistance - accumulated;
    const ratio = segmentLength > 0 ? Math.min(1, remaining / segmentLength) : 0;
    const p0 = path[segmentIndex];
    const p1 = path[segmentIndex + 1] ?? p0;

    results.push({
      point: {
        lat: p0.lat + (p1.lat - p0.lat) * ratio,
        lng: p0.lng + (p1.lng - p0.lng) * ratio,
      },
      routeProgress: targetProgress,
      radiusMeters,
    });
  }

  return results;
}
