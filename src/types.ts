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
}

export type StatsPeriod = "daily" | "weekly" | "monthly";

export interface AggregatedFood {
  foodTypeId: string;
  name: string;
  color: string;
  unit: string;
  amount: number;
}
