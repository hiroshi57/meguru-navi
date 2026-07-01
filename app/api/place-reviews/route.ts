import { NextRequest, NextResponse } from "next/server";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

interface GoogleReview {
  author_name: string;
  rating: number;
  relative_time_description: string;
  text: string;
}

/**
 * Place Details API から口コミ(最大5件、Google側の仕様)のみを取得する。
 * コース内の各スポットに対してユーザーが明示的に開いた時だけ呼ぶ想定（全候補分は取得しない）。
 */
export async function GET(req: NextRequest) {
  if (!GOOGLE_MAPS_API_KEY) {
    return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY が設定されていません" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const placeId = searchParams.get("placeId");

  if (!placeId) {
    return NextResponse.json({ error: "placeId は必須です" }, { status: 400 });
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "review,rating,user_ratings_total");
  url.searchParams.set("language", "ja");
  url.searchParams.set("key", GOOGLE_MAPS_API_KEY);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK") {
    return NextResponse.json({ error: data.status ?? "口コミの取得に失敗しました" }, { status: 502 });
  }

  const reviews = ((data.result?.reviews ?? []) as GoogleReview[]).map((r) => ({
    authorName: r.author_name,
    rating: r.rating,
    relativeTime: r.relative_time_description,
    text: r.text,
  }));

  return NextResponse.json({ reviews });
}
