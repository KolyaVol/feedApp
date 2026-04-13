export type MealType = "morning" | "lunch" | "evening";

export interface MealEntry {
  product: string;
  grams: number;
}

export interface FeedDay {
  id: string;
  date: string;
  morning: MealEntry[];
  lunch: MealEntry[];
  evening: MealEntry[];
  notes: string;
  eaten?: Partial<Record<MealType, boolean>>;
}

export interface AggregatedFood {
  name: string;
  color: string;
  amount: number;
}

export interface BestPracticesSection {
  title: string;
  items: string[];
}

export interface BestPracticesData {
  productOrder: { product: string; ageMonths: number; notes?: string }[];
  portionGuide: { ageMonths: number; mealType: MealType; grams: number }[];
  safetyTips: string[];
  sections: BestPracticesSection[];
  updatedAt?: string;
}
