import { Course } from "@/lib/types";

/**
 * Google Maps JavaScript API キー設定後、このコンポーネントを実際の地図表示に置き換える。
 * それまでは座標とルート順を簡易リストで確認できるようにしておく。
 */
export function MapPlaceholder({ course }: { course: Course }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/20 bg-black/[0.02] p-6">
      <p className="text-sm font-medium text-black/60">
        🗺️ 地図表示は Google Maps APIキー設定後に有効になります
      </p>
      <p className="mt-1 text-xs text-black/40">
        現在は座標リストのみ表示しています（Maps JavaScript API / Directions API 連携予定）
      </p>
      <ul className="mt-4 flex flex-col gap-1 font-mono text-xs text-black/50">
        {course.stops.map((stop, index) => (
          <li key={stop.spot.id}>
            {index + 1}. {stop.spot.name} ({stop.spot.lat.toFixed(4)}, {stop.spot.lng.toFixed(4)})
          </li>
        ))}
      </ul>
    </div>
  );
}
