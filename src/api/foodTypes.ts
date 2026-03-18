import type { FoodType } from "../types";
import { request } from "./client";

export async function getFoodTypes(): Promise<FoodType[]> {
  return request<FoodType[]>("GET", "/api/food-types");
}

export async function addFoodType(food: Omit<FoodType, "id"> & { id: string }): Promise<FoodType> {
  return request<FoodType>("POST", "/api/food-types", food);
}

export async function updateFoodType(id: string, updates: Partial<Omit<FoodType, "id">>): Promise<void> {
  await request("PATCH", `/api/food-types/${encodeURIComponent(id)}`, updates);
}

export async function deleteFoodType(id: string): Promise<void> {
  await request("DELETE", `/api/food-types/${encodeURIComponent(id)}`);
}
