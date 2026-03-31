export type FoodPriority = "low" | "middle" | "high";

export interface FoodType {
  id: string;
  name: string;
  unit: string;
  color: string;
  priority?: FoodPriority;
  weeklyMinimumAmount?: number;
}

export interface FeedEntry {
  id: string;
  foodTypeId: string;
  amount: number;
  timestamp: number;
}

export interface Reminder {
  id: string;
  title: string;
  time: string;
  enabled: boolean;
  repeat?: "daily" | "weekdays";
  notificationId?: string;
  linkedMealType?: MealType;
}

export type MealType = "morning" | "lunch" | "evening";

export interface DayMealEntry {
  mealType: MealType;
  product: string;
  amountGrams: number;
}

export interface DayPlan {
  date: string;
  weekNumber: number;
  dayNumber: number;
  notes?: string;
  meals: DayMealEntry[];
  sourceMonth: number;
}

export type StatsPeriod = "daily" | "weekly" | "monthly";

export interface AggregatedFood {
  foodTypeId: string;
  name: string;
  color: string;
  unit: string;
  amount: number;
}

export interface PlanDay {
  id: string;
  date: string;
  time: string;
  foodType: string;
  food: string;
  amountGrams: number;
  substitutions: string[];
  notes?: string;
  sourceMonth: number;
  weekNumber: number;
  scheduleId: string;
}

export interface LoadedSchedule {
  id: string;
  month: number;
  startDate: string;
  endDate: string;
  signsOfReadiness: string[];
  safetyGuidelines: string[];
  allowedProducts?: string[];
  loadedAt: string;
}

export type ShiftMode = "mealType" | "product";

export interface ShiftOperation {
  id: string;
  mode: ShiftMode;
  mealType: MealType;
  shiftDays: number;
  createdAt: string;
  fromDate?: string;
  product?: string;
}

export type EatenMealsByDate = Record<string, Record<string, boolean>>;

export interface UserOverlayState {
  schemaVersion: number;
  shifts: ShiftOperation[];
  eatenMealsByDate: EatenMealsByDate;
  eatenProducts: Record<string, true>;
  replacementsByDate: Record<string, Partial<Record<MealType, { product: string; amountGrams: number }>>>;
  updatedAt: string;
}
