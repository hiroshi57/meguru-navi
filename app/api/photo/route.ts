import { NextRequest, NextResponse } from "next/server";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/**
 * Google Places Photo API をサーバー経由でプロキシする。
 * クライアントに直接キーを渡さないための中継専用エンドポイント。
 */
export async function GET(req: NextRequest) {
  if (!GOOGLE_MAPS_API_KEY) {
    return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY が設定されていません" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const ref = searchParams.get("ref");
  const maxwidth = searchParams.get("maxwidth") ?? "400";

  if (!ref) {
    return NextResponse.json({ error: "ref は必須です" }, { status: 400 });
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/photo");
  url.searchParams.set("photo_reference", ref);
  url.searchParams.set("maxwidth", maxwidth);
  url.searchParams.set("key", GOOGLE_MAPS_API_KEY);

  const res = await fetch(url.toString());
  if (!res.ok || !res.body) {
    return NextResponse.json({ error: "画像の取得に失敗しました" }, { status: 502 });
  }

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
