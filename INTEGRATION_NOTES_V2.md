# 複数エリア対応(起点→目的地) 統合手順 v2

実コードに合わせて全面的に作り直した版。
**v1の `lib/corridor-spots.ts` と `app/api/geocode/route.ts` は不要になったので破棄してください。**
目的地のジオコーディングは既存の `geocodeArea`(Places Text Search)を再利用するため、Geocoding APIの追加有効化も不要です。

## 納品ファイル

| ファイル | 扱い |
|---|---|
| `lib/types.ts` | **既存ファイルを置き換え**(追加のみ・破壊的変更なし) |
| `app/api/spots/route.ts` | **既存ファイルを置き換え**(destLabel分岐を追加) |
| `lib/course-builder.ts` | **既存ファイルを置き換え**(目的地指定時のp2p分岐を追加) |
| `components/InputForm.tsx` | **既存ファイルを置き換え**(目的地入力欄を追加) |
| `app/page.tsx` | **既存ファイルを置き換え**(見出し・0件メッセージの分岐) |
| `components/CourseCard.tsx` | **既存ファイルを置き換え**(ゴール行の追加) |
| `components/CourseMap.tsx` | **既存ファイルを置き換え**(Gピン＋実経路ポリライン描画) |
| `CLAUDE.md` | **既存ファイルを置き換え**(実装完了を反映、Next Step再編) |
| `lib/route-corridor.ts` | **新規追加** |
| `lib/course-builder-p2p.ts` | **新規追加** |

型チェック済み・統合テスト済み(モックしたfetchで buildCourses の周回/通り抜け両分岐を検証: 一方向順・予算内到達・王道/穴場の非重複・mealTiming=noneの食事系除外・destLabel空白時の周回フォールバックを確認)。

## 変更内容の要約

### types.ts(追加フィールドのみ)
- `SearchParams.destLabel?: string` — 目的地(任意)
- `Spot.routeProgress?: number` — 経路沿い検索時のみ。起点=0〜目的地=1の進行度
- `Course.destination?` / `Course.finalLegMinutes?` / `Course.routePolyline?` — 一方向コース用

### app/api/spots/route.ts
- `destLabel` クエリパラメータを追加。指定時は:
  1. `geocodeArea` で目的地を座標化
  2. Directions APIで経路を取得(失敗時は直線ルートにフォールバック — 既存方針踏襲)
  3. `buildCorridorSearchPoints` で経路沿いに最大5点の検索ポイントを生成
  4. 各ポイント×mood別クエリでNearby Searchを並行実行
  5. 重複排除(同一place_idは起点に近い進行度を採用)し、進行度昇順で返す
- レスポンスに `destination` と `routePolyline` が追加される(destLabel指定時のみ)
- 従来の周回検索は完全に無変更(重複排除・予算フィルタを `collectSpots` に共通化したが挙動は同一)
- **API費用の目安**: destLabel指定時は Nearby Search が最大 5点×2クエリ=10回 + Directions 1回。上限は `MAX_CORRIDOR_SAMPLE_POINTS` 定数で調整可能

### lib/course-builder.ts
- `fetchSpots` が `destLabel` を送り、`destination`/`routePolyline` を受け取るよう拡張
- `buildCourses` に目的地指定時の分岐を追加: `buildPointToPointCourses` を呼び、王道/穴場の2コース(既存と同じ非重複方針)を返す。各Courseに `routePolyline` を付与
- **mealTimingの制約**: 一方向コースは進行度順が確定のため `first_half`/`second_half` の並び替えは適用不可(後戻りが発生するため)。`none`(食事系除外)のみ反映し、他は無視する
- 従来の周回コース生成は無変更

### components/InputForm.tsx
- 起点欄の直後に「目的地(任意)」テキスト入力を追加。座標化はサーバー側で行うためフォームからのAPI呼び出しは無し
- 目的地入力時は送信ボタンが「通り抜けコースを探す」に変わる

## 追加統合分（今回完了）

### app/page.tsx
- 目的地指定時にコース0件だった場合の専用メッセージ（「この時間では目的地までの移動だけで精一杯…」）
- 結果見出しを「{起点} → {目的地} の提案コース」に分岐

### components/CourseCard.tsx
- `course.destination` がある場合、スポット一覧の末尾に「G」マーカーのゴール行を追加（移動 約{finalLegMinutes}分・到着 +{totalMinutes}分・目的地名）
- 最終スポットの縦線をゴール行まで延長

### components/CourseMap.tsx
- 目的地ピン（label "G"）を追加し、boundsにも含める
- `course.routePolyline` があれば `decodePolyline`（lib/route-corridor.ts）でDirectionsの実経路を描画。無ければ従来どおり起点→各スポット（→目的地）の直線でフォールバック
- ライブラリ追加（`libraries=geometry`）は不要な自前デコード方式を採用

### lib/types.ts 追加
- `Course.destinationLabel?: string` — CourseCardでの目的地名表示用（course-builder.tsがdestLabelのtrim値を付与）

## 統合完了・残作業なし

全ファイルの統合が完了。手作業はプロジェクトへのファイル配置のみ:
1. 出力の各ファイルをリポジトリの同名パスに上書き配置
2. `npm run dev` で起動し、起点「新宿駅」目的地「渋谷駅」徒歩・3時間で動作確認
3. 型チェックは実プロジェクトの `tsc` でも念のため確認（当方はmoods.ts等をスタブ復元してチェック済みのため）

## 設計上の判断メモ

- **経路沿い検索の半径は固定(移動手段別400〜1000m)**: 周回検索の`calcSearchRadiusMeters`(時間比例)と違い、経路からの「逸れ幅」は使える時間ではなく移動手段の感覚で決まるため
- **目的地到達を確定要件として扱う**: 各スポット採用前に「そこから目的地までの残り移動時間(概算)」込みで予算判定。周回コースの「超える手前で打ち切り」と違い、超えるスポットはスキップして次を試す
- **スポットの分散**: 直前採用スポットから「1/maxStopsの半分」以上の進行度間隔を要求し、起点付近への固まりを防止
