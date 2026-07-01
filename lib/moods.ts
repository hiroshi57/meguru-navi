import { BudgetId, MoodDefinition, TransportId } from "./types";

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

export const DURATION_OPTIONS = [60, 90, 120, 180, 240] as const;

export const PARTY_SIZE_OPTIONS = [1, 2, 3, 4, 5] as const;
