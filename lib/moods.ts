import {
  AgeBracket,
  BudgetId,
  Cuisine,
  IndoorOutdoor,
  MealTiming,
  MoodDefinition,
  Pace,
  Purpose,
  SpecialCondition,
  TransportId,
  Vibe,
} from "./types";

export const MOODS: MoodDefinition[] = [
  { id: "mattari", label: "まったり", emoji: "🌿", description: "公園・カフェでゆったり過ごしたい" },
  { id: "gourmet", label: "グルメ", emoji: "🍽️", description: "食べ歩き・食事を中心に楽しみたい" },
  { id: "active", label: "アクティブ", emoji: "🚶", description: "歩き回ってたくさん巡りたい" },
  { id: "photo", label: "写真映え", emoji: "📷", description: "映えるスポットを中心に回りたい" },
];

export const BUDGETS: { id: BudgetId; label: string }[] = [
  { id: "under2000", label: "〜¥2,000" },
  { id: "under5000", label: "〜¥5,000" },
  { id: "under10000", label: "〜¥10,000" },
  { id: "any", label: "こだわらない" },
];

export const TRANSPORTS: { id: TransportId; label: string; speedKmh: number }[] = [
  { id: "walk", label: "徒歩", speedKmh: 4.5 },
  { id: "bike", label: "自転車", speedKmh: 13 },
  { id: "train", label: "電車", speedKmh: 18 },
  { id: "car", label: "車", speedKmh: 16 },
];

export const DURATION_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 120, label: "ちょい寄り道（〜2時間）" },
  { minutes: 180, label: "数時間（〜3時間）" },
  { minutes: 300, label: "半日（〜5時間）" },
  { minutes: 540, label: "1日（〜9時間）" },
];

export const PARTY_SIZE_OPTIONS = [1, 2, 3, 4, 5] as const;

export const AGE_BRACKETS: { id: AgeBracket; label: string }[] = [
  { id: "10s", label: "10代" },
  { id: "20s", label: "20代" },
  { id: "30s", label: "30代" },
  { id: "40s", label: "40代" },
  { id: "50s_plus", label: "50代以上" },
];

export const PURPOSES: { id: Purpose; label: string; description: string }[] = [
  { id: "sightseeing", label: "観光", description: "定番スポットを一通り巡りたい" },
  { id: "couple", label: "カップル・夫婦でゆっくり", description: "落ち着いた雰囲気を優先し、賑やかすぎる場所は避ける" },
  { id: "family", label: "家族・子どもと", description: "子ども連れでも安心な場所を優先し、お酒中心の店は避ける" },
  { id: "friends", label: "友人とワイワイ", description: "カラオケ・立ち飲みなどテンション高めの場所もOK" },
  { id: "solo", label: "一人でゆっくり", description: "一人でも入りやすい静かな場所を優先" },
];

export const VIBES: { id: Vibe; label: string }[] = [
  { id: "calm", label: "静か・まったり" },
  { id: "lively", label: "賑やか・にぎやか" },
];

export const PACES: { id: Pace; label: string; description: string }[] = [
  { id: "relaxed", label: "のんびり派", description: "少数のスポットをじっくり" },
  { id: "packed", label: "サクサク派", description: "できるだけ多くのスポットを周る" },
];

export const MEAL_TIMINGS: { id: MealTiming; label: string }[] = [
  { id: "none", label: "食事は含めない" },
  { id: "first_half", label: "前半に食事" },
  { id: "second_half", label: "後半（締め）に食事" },
  { id: "any", label: "こだわらない" },
];

export const INDOOR_OUTDOOR_OPTIONS: { id: IndoorOutdoor; label: string }[] = [
  { id: "outdoor", label: "屋外中心" },
  { id: "indoor", label: "屋内中心" },
  { id: "either", label: "どちらでも" },
];

export const SPECIAL_CONDITIONS: { id: SpecialCondition; label: string }[] = [
  { id: "no_stairs", label: "階段・段差NG（バリアフリー希望）" },
  { id: "no_alcohol", label: "お酒NG" },
  { id: "no_smoking", label: "禁煙希望" },
  { id: "pet_friendly", label: "ペット同伴あり" },
];

export const CUISINES: { id: Cuisine; label: string }[] = [
  { id: "any", label: "こだわらない" },
  { id: "general", label: "レストラン" },
  { id: "ramen", label: "ラーメン" },
  { id: "western", label: "洋食" },
  { id: "soba", label: "そば" },
];
