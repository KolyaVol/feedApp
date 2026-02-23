import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FoodType } from "../types";
import { KEYS } from "./storageKeys";

const DEFAULT_FOOD_TYPES: FoodType[] = [
  { id: "1", name: "Breast", unit: "ml", color: "#FFB6C1" },
  { id: "2", name: "Formula", unit: "ml", color: "#87CEEB" },
  { id: "3", name: "Puree", unit: "g", color: "#98FB98" },
  { id: "4", name: "Water", unit: "ml", color: "#ADD8E6" },
];

export async function getFoodTypes(): Promise<FoodType[]> {
  const raw = await AsyncStorage.getItem(KEYS.FOOD_TYPES);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_FOOD_TYPES;
    }
  }
  await AsyncStorage.setItem(KEYS.FOOD_TYPES, JSON.stringify(DEFAULT_FOOD_TYPES));
  return DEFAULT_FOOD_TYPES;
}

export async function setFoodTypes(items: FoodType[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.FOOD_TYPES, JSON.stringify(items));
}

export async function addFoodType(food: Omit<FoodType, "id">): Promise<FoodType> {
  const list = await getFoodTypes();
  const id = String(Date.now());
  const newItem: FoodType = { ...food, id };
  list.push(newItem);
  await setFoodTypes(list);
  return newItem;
}

export async function updateFoodType(id: string, updates: Partial<FoodType>): Promise<void> {
  const list = await getFoodTypes();
  const i = list.findIndex((f) => f.id === id);
  if (i === -1) return;
  list[i] = { ...list[i], ...updates };
  await setFoodTypes(list);
}

export async function deleteFoodType(id: string): Promise<void> {
  const list = await getFoodTypes().then((arr) => arr.filter((f) => f.id !== id));
  await setFoodTypes(list);
}
