import type { FoodType } from "../types";
import * as foodTypesData from "../data/foodTypes";
import { useAsyncList } from "./useAsyncList";

export function useFoodTypes(): {
  foodTypes: FoodType[];
  loading: boolean;
  refresh: () => Promise<void>;
  addFoodType: (food: Omit<FoodType, "id">) => Promise<FoodType>;
  updateFoodType: (id: string, updates: Partial<FoodType>) => Promise<void>;
  deleteFoodType: (id: string) => Promise<void>;
} {
  const { items, loading, refresh, add, update, remove } = useAsyncList<FoodType>({
    fetch: foodTypesData.getFoodTypes,
    add: foodTypesData.addFoodType,
    update: foodTypesData.updateFoodType,
    remove: foodTypesData.deleteFoodType,
  });

  return {
    foodTypes: items,
    loading,
    refresh,
    addFoodType: add!,
    updateFoodType: update!,
    deleteFoodType: remove!,
  };
}
