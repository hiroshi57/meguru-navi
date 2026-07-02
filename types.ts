export interface LatLng {
  lat: number;
  lng: number;
}

export type MoodId = "mattari" | "gourmet" | "active" | "photo";

export interface MoodDefinition {
  id: MoodId;
  label: string;
  emoji: string;
  description: string;
}

export type BudgetId = "under2000" | "under5000" | "under10000" | "any";
export type TransportId = "walk" | "bike" | "train" | "car";

export type AgeBracket = "10s" | "20s" | "30s" | "40s" | "50s_plus";
export type Purpose = "sightseeing" | "couple" | "family" | "friends" | "solo";
export type Vibe = "calm" | "lively";
export type Pace = "relaxed" | "packed";
export type MealTiming = "none" | "first_half" | "second_half" | "any";
export type IndoorOutdoor = "outdoor" | "indoor" | "either";
/** グルメ気分を選んだ時のみ使う料理ジャンル絞り込み。 */
export type Cuisine = "any" | "general" | "ramen" | "western" | "soba";
/** 「こだわり条件」の複数選択項目。Google Places側の属性データが乏しいため、
 * いずれもベストエフォート（検索キーワードでの重み付け・タイプ除外）であり完全な保証はしない。 */
export type SpecialCondition = "no_stairs" | "no_alcohol" | "no_smoking" | "pet_friendly";

export interface SearchParams {
  mood: MoodId;
  budget: BudgetId;
  areaLabel: string;
  transport: TransportId;
  durationMinutes: number;
  partySize: number;
  ageBracket: AgeBracket;
  purpose: Purpose;
  vibe: Vibe;
  pace: Pace;
  mealTiming: MealTiming;
  indoorOutdoor: IndoorOutdoor;
  specialConditions: SpecialCondition[];
  cuisine: Cuisine;
}

export interface Spot {
  id: string;
  name: string;
  category: string;
  moods: MoodId[];
  lat: number;
  lng: number;
  stayMinutes: number;
  /** Google Places 準拠の 0(無料)〜4(高額) の目安 */
  priceLevel: 0 | 1 | 2 | 3 | 4;
  description: string;
  /** Google Places Photo API用の参照ID。/api/photo?ref=... で画像を取得する。 */
  photoRef?: string;
  rating?: number;
  userRatingsTotal?: number;
}

export interface SeasonalEvent {
  id: string;
  spotId: string;
  title: string;
  description: string;
  validFrom: string;
  validTo: string;
}

export interface CourseStop {
  spot: Spot;
  travelMinutesFromPrevious: number;
  arrivalOffsetMinutes: number;
  departureOffsetMinutes: number;
  events: SeasonalEvent[];
}

export interface Course {
  id: string;
  title: string;
  tag: string;
  totalMinutes: number;
  origin: LatLng;
  stops: CourseStop[];
}
