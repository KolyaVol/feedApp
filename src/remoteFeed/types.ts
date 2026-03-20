export type RemoteMealType = "morning" | "lunch" | "evening";

export interface RemoteFeedSlot {
  name: RemoteMealType;
  time: string;
  purpose?: string;
  rules?: string[];
  activation_condition?: string;
}

export interface RemoteFeedDayMeal {
  product: string;
  amount_grams: number;
}

export interface RemoteFeedPlanDay {
  day: number;
  notes?: string;
  morning?: RemoteFeedDayMeal;
  lunch?: RemoteFeedDayMeal[];
  evening?: RemoteFeedDayMeal[];
}

export interface RemoteFeedPlanWeek {
  week: number;
  focus?: string;
  notes?: string;
  allowed_products?: {
    vegetables?: string[];
    cereals?: string[];
    fruits?: string[];
    meat?: string[];
  };
  days: RemoteFeedPlanDay[];
}

export interface RemoteFeedSchedule {
  month: number;
  breastfeeding?: {
    on_demand?: boolean;
    priority?: string;
    rules?: string[];
  };
  feeding_schedule?: {
    meal_slots?: RemoteFeedSlot[];
  };
  introduction_plan: RemoteFeedPlanWeek[];
  hidden_risks?: string[];
  allowed_products?: {
    vegetables?: string[];
    cereals?: string[];
    fruits?: string[];
    meat?: string[];
  };
}

export interface RemoteFeedMeal {
  type: RemoteMealType;
  title: string;
  time?: string;
  items: RemoteFeedDayMeal[];
  rules: string[];
  notes?: string;
}

export interface RemoteFeedToday {
  date: string;
  week: number;
  day: number;
  meals: RemoteFeedMeal[];
  advice: string[];
}

