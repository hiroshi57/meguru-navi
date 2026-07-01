import { SeasonalEvent } from "./types";

/**
 * MVPデモ用のダミー季節イベント・お得情報。
 * 実運用ではキュレーション管理画面 or CMS からの取得に置き換える想定。
 */
export const MOCK_EVENTS: SeasonalEvent[] = [
  {
    id: "event-01",
    spotId: "spot-01",
    title: "夏の夜間ライトアップ",
    description: "池の周りが期間限定でライトアップされ、夜の散策が楽しめます。",
    validFrom: "2026-06-15",
    validTo: "2026-08-31",
  },
  {
    id: "event-02",
    spotId: "spot-03",
    title: "食べ歩きスタンプラリー",
    description: "3店舗巡るとドリンク1杯無料になるスタンプラリー開催中。",
    validFrom: "2026-06-01",
    validTo: "2026-07-31",
  },
  {
    id: "event-05",
    spotId: "spot-06",
    title: "平日限定サウナ割",
    description: "平日14時までの入場で入館料が200円引きになります。",
    validFrom: "2026-04-01",
    validTo: "2026-09-30",
  },
  {
    id: "event-06",
    spotId: "spot-12",
    title: "夏季限定クラフトビールフェア",
    description: "季節限定の醸造所コラボビールを飲み比べセットで提供。",
    validFrom: "2026-06-20",
    validTo: "2026-08-20",
  },
];

export function isEventActive(event: SeasonalEvent, today: Date): boolean {
  const from = new Date(event.validFrom);
  const to = new Date(event.validTo);
  return today >= from && today <= to;
}
