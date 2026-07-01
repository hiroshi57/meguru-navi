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

Google Maps APIキー未取得のため、**Places/Directions/Maps JS API 連携前のモック実装**まで完了。
UI・周回コース生成ロジックはモックデータで動作確認済み。APIキー取得後に以下を差し替える。

| モック実装 | 置き換え先 |
|---|---|
| `lib/mock-spots.ts` | Places API（Nearby Search / Text Search）によるスポット取得 |
| `lib/course-builder.ts` の `haversineDistanceKm` + 固定倍率での移動時間近似 | Directions API（Distance Matrix）による実移動時間 |
| `components/MapPlaceholder.tsx` | Maps JavaScript API による実地図表示（ピン＋周回ルート線） |
| `lib/mock-events.ts` | 季節イベント/お得情報のキュレーション管理（当面は手動更新のJSON/CMSを想定） |

## ファイルマップ

```
app/page.tsx              入力フォーム→コース生成→結果表示のメインページ
components/InputForm.tsx  6項目（気分・予算・行動範囲・移動手段・時間・人数）の入力フォーム
components/CourseCard.tsx 生成された周回コースの表示（訪問順・移動時間・イベント情報）
components/MapPlaceholder.tsx  地図表示部分（APIキー設定まではプレースホルダー）
lib/types.ts               SearchParams / Spot / Course などの型定義
lib/moods.ts                気分・予算・移動手段・人数などの選択肢定義
lib/mock-spots.ts           MVPデモ用ダミースポットデータ（渋谷〜恵比寿〜代官山）
lib/mock-events.ts          MVPデモ用ダミー季節イベント・お得情報
lib/course-builder.ts       候補地フィルタ＋貪欲法による周回コース生成ロジック
```

## 周回コース生成ロジックの方針

- スポット数が少ない（十数件程度）ためTSPの厳密解は不要。貪欲法（現在地から最寄りの未訪問候補地を順に選ぶ）で実用十分なルートを生成
- 移動時間は直線距離 ÷ 移動手段別の想定速度 × 1.3（信号待ち・乗換等の補正）で近似。Directions API連携後はこの補正を撤廃し実測値に置き換える
- 「王道コース」「穴場コース」の2パターンは、貪欲法の起点選択を変える（最寄り優先 or 2番目に近い候補から開始）ことで多様性を出している。パターンを増やす場合はこの分岐ロジックを拡張する

## Next Step（ユーザー側アクション）

1. Google Cloud Console で Places API / Directions API / Maps JavaScript API を有効化し、APIキーを取得
2. 公開サービスのため、APIキーはNext.jsのRoute Handler経由でサーバーサイドから呼び出す設計とし、クライアントに直接キーを渡さない（利用量上限・リファラ制限も要設定）
3. APIキー取得後、上記「現状の実装状況」の対応表に沿ってモック実装を実データに置き換える
