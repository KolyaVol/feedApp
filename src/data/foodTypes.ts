import type { FoodType } from "../types";
import { foodTypePresetColors } from "../theme";
import { KEYS } from "./storageKeys";
import { createStorageList } from "./storage";

const DEFAULT_FOOD_TYPES: FoodType[] = [
  { id: "1", name: "Breast", unit: "ml", color: foodTypePresetColors[0] },
  { id: "2", name: "Formula", unit: "ml", color: foodTypePresetColors[1] },
  { id: "3", name: "Puree", unit: "g", color: foodTypePresetColors[2] },
  { id: "4", name: "Water", unit: "ml", color: foodTypePresetColors[3] },
];

export const foodTypesStorage = createStorageList<FoodType>(KEYS.FOOD_TYPES, {
  defaultItems: DEFAULT_FOOD_TYPES,
});

export const getFoodTypes = foodTypesStorage.getList;
export const setFoodTypes = foodTypesStorage.setList;

export async function addFoodType(food: Omit<FoodType, "id">): Promise<FoodType> {
  return foodTypesStorage.addItem(food);
}

export async function updateFoodType(id: string, updates: Partial<FoodType>): Promise<void> {
  return foodTypesStorage.updateItem(id, updates);
}

export async function deleteFoodType(id: string): Promise<void> {
  return foodTypesStorage.deleteItem(id);
}
