import { Course } from "@/lib/types";

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

export function CourseCard({ course }: { course: Course }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
            {course.tag}
          </span>
          <h3 className="mt-2 text-lg font-semibold">{course.title}</h3>
        </div>
        <div className="text-right text-sm text-black/50">
          所要時間目安
          <div className="text-base font-semibold text-black/80">{formatMinutes(course.totalMinutes)}</div>
        </div>
      </div>

      <ol className="mt-5 flex flex-col gap-4">
        {course.stops.map((stop, index) => (
          <li key={stop.spot.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
                {index + 1}
              </div>
              {index < course.stops.length - 1 && <div className="mt-1 w-px flex-1 bg-black/10" />}
            </div>
            <div className="flex-1 pb-2">
              <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-black/40">
                <span>移動 約{stop.travelMinutesFromPrevious}分</span>
                <span>到着 +{stop.arrivalOffsetMinutes}分</span>
                <span>滞在 約{stop.spot.stayMinutes}分</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-medium">{stop.spot.name}</span>
                <span className="rounded bg-black/5 px-1.5 py-0.5 text-[11px] text-black/50">
                  {stop.spot.category}
                </span>
              </div>
              <p className="mt-1 text-sm text-black/60">{stop.spot.description}</p>
              {stop.events.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  {stop.events.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                    >
                      🎉 {event.title} — {event.description}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
