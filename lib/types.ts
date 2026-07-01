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

export interface SearchParams {
  mood: MoodId;
  budget: BudgetId;
  areaLabel: string;
  transport: TransportId;
  durationMinutes: number;
  partySize: number;
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
