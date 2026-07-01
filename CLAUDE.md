@AGENTS.md

# CLAUDE.md — MeguruNavi

気分・予算・行動範囲・移動手段・時間・人数から、時間内で周れる散策コースを提案する公開Webサービス。
単なるスポット提案で終わらせず、季節イベント/お得情報を絡めることで周回コースのバリエーションを増やすのがコンセプト。

## 決定事項（企画フェーズ）

- 利用対象: 一般公開サービス
- 対象エリア（MVP）: 東京23区
- データ取得: Google Places API（スポット検索） / Directions API（周回ルート・移動時間） / Maps JavaScript API（地図表示）
- 技術スタック: Next.js + Vercel（社内の他ダッシュボード群と同一運用フローを踏襲）
- 気分カテゴリ（MVP 4種）: まったり / グルメ / アクティブ / 写真映え

## 現状の実装状況

Google Maps Platform（Places / Directions / Maps JavaScript の3API）と実データ連携済み。
モックデータは全て廃止し、`app/api/spots` `app/api/directions` の Route Handler 経由で実データを取得している。

**保留中**: 季節イベント/お得情報機能。実店舗のPlace IDに対応するキュレーションデータの管理基盤（手動更新JSON/CMS等）が未設計のため、`CourseStop.events` は常に空配列を返す状態。設計時は `lib/types.ts` の `SeasonalEvent` 型を流用する想定。

## APIキー運用

- `GOOGLE_MAPS_API_KEY`（`.env.local`, サーバー専用）: Places / Directions を Route Handler からのみ呼び出す
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`（`.env.local`, クライアント公開）: Maps JavaScript API の地図表示に使用。ブラウザに露出する前提のキーのため、**本番公開前に別キーへ分離しHTTPリファラー制限をかけること**（現状は開発用に同一キーを流用中）
- Vercelにデプロイする場合は上記2つの環境変数をVercel側にも設定する必要がある

## ファイルマップ

```
app/page.tsx                    入力フォーム→コース生成(非同期)→結果表示のメインページ
app/api/spots/route.ts          Places API(Text Search + Nearby Search)のプロキシ。mood別のtype/keywordでスポット検索
app/api/directions/route.ts     Directions APIのプロキシ。2地点+移動手段から実移動時間(分)を返す
components/InputForm.tsx        6項目（気分・予算・行動範囲・移動手段・時間・人数）の入力フォーム
components/CourseCard.tsx       生成された周回コースの表示（訪問順・移動時間・イベント情報）
components/CourseMap.tsx        Maps JavaScript APIによる実地図表示（ピン＋周回ルート線）
lib/types.ts                    SearchParams / Spot / Course などの型定義
lib/moods.ts                    気分・予算・移動手段・人数などの選択肢定義
lib/course-builder.ts           /api/spots・/api/directions を呼び出して周回コースを生成する非同期ロジック
```

## 周回コース生成ロジックの方針

- スポット数が少ない（1エリアあたり十数件程度）ためTSPの厳密解は不要。まず直線距離ベースの貪欲法で訪問順を仮決め（`pickGreedyOrder`、APIコール無し・高速）
- 仮決めした順路に沿って `refineWithRealDurations` がDirections APIを1区間ずつ呼び出し、実移動時間で到着/出発オフセットを再計算。時間予算を超える手前で打ち切る
- Directions API呼び出しが失敗した場合は直線距離からの概算（想定速度×1.3の補正）にフォールバックし、コース生成自体は止めない
- 「王道コース」「穴場コース」の2パターンは、貪欲法の起点選択を変える（最寄り優先 or 2番目に近い候補から開始）ことで多様性を出している

## Next Step

1. 季節イベント/お得情報のキュレーション基盤を設計（実店舗のPlace IDにどう紐付けるか）
2. 本番公開前に Maps JavaScript API 用キーをHTTPリファラー制限付きの別キーに分離
3. Vercelへのデプロイ・環境変数設定
