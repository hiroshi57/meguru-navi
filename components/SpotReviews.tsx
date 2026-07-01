"use client";

import { useState } from "react";

interface Review {
  authorName: string;
  rating: number;
  relativeTime: string;
  text: string;
}

export function SpotReviews({ placeId }: { placeId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (reviews || loading) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/place-reviews?placeId=${encodeURIComponent(placeId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "口コミの取得に失敗しました");
      setReviews(data.reviews);
    } catch (err) {
      setError(err instanceof Error ? err.message : "口コミの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleToggle}
        className="text-xs font-medium text-emerald-700 hover:underline"
      >
        {open ? "口コミを閉じる ▲" : "口コミを見る ▼"}
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2">
          {loading && <p className="text-xs text-black/40">読み込み中…</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
          {reviews && reviews.length === 0 && (
            <p className="text-xs text-black/40">口コミが見つかりませんでした</p>
          )}
          {reviews?.slice(0, 3).map((review, index) => (
            <div key={index} className="rounded-lg bg-black/[0.03] p-2 text-xs">
              <div className="flex items-center justify-between text-black/50">
                <span className="font-medium text-black/70">{review.authorName}</span>
                <span>
                  {"★".repeat(Math.round(review.rating))} ・ {review.relativeTime}
                </span>
              </div>
              <p className="mt-1 line-clamp-3 text-black/60">{review.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
