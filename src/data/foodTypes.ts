import type { FoodType } from "../types";
import { generateId } from "../utils/id";
import * as api from "../api/foodTypes";

export async function getFoodTypes(): Promise<FoodType[]> {
  return api.getFoodTypes();
}

export async function setFoodTypes(_items: FoodType[]): Promise<void> {
  // Cloud sync: full replace not supported
}

export async function addFoodType(food: Omit<FoodType, "id">): Promise<FoodType> {
  const id = generateId();
  return api.addFoodType({ ...food, id });
}

export async function updateFoodType(id: string, updates: Partial<FoodType>): Promise<void> {
  await api.updateFoodType(id, updates);
}

export async function deleteFoodType(id: string): Promise<void> {
  await api.deleteFoodType(id);
}
