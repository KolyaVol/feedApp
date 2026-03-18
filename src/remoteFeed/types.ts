export interface RemoteFeedSchedule {
  month: number;
  signs_of_readiness?: string[];
  safety_guidelines?: string[];
  weekly_schedule: RemoteFeedWeek[];
}

export interface RemoteFeedWeek {
  week: number;
  days: RemoteFeedDay[];
}

export interface RemoteFeedDay {
  day: number;
  time: string;
  food_type: string;
  food: string;
  amount_grams: number;
  substitutions?: string[];
  notes?: string;
}

export interface RemoteFeedMeal {
  time: string;
  food: string;
  notes?: string;
  foodType?: string;
  amountGrams?: number;
}

export interface RemoteFeedToday {
  date: string; // YYYY-MM-DD
  meals: RemoteFeedMeal[];
}

