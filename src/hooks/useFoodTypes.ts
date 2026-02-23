import { useCallback, useEffect, useState } from "react";
import type { FoodType } from "../types";
import * as foodTypesData from "../data/foodTypes";

export function useFoodTypes(): {
  foodTypes: FoodType[];
  loading: boolean;
  refresh: () => Promise<void>;
  addFoodType: (food: Omit<FoodType, "id">) => Promise<FoodType>;
  updateFoodType: (id: string, updates: Partial<FoodType>) => Promise<void>;
  deleteFoodType: (id: string) => Promise<void>;
} {
  const [foodTypes, setFoodTypes] = useState<FoodType[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await foodTypesData.getFoodTypes();
    setFoodTypes(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addFoodType = useCallback(
    async (food: Omit<FoodType, "id">) => {
      const added = await foodTypesData.addFoodType(food);
      await refresh();
      return added;
    },
    [refresh],
  );

  const updateFoodType = useCallback(
    async (id: string, updates: Partial<FoodType>) => {
      await foodTypesData.updateFoodType(id, updates);
      await refresh();
    },
    [refresh],
  );

  const deleteFoodType = useCallback(
    async (id: string) => {
      await foodTypesData.deleteFoodType(id);
      await refresh();
    },
    [refresh],
  );

  return {
    foodTypes,
    loading,
    refresh,
    addFoodType,
    updateFoodType,
    deleteFoodType,
  };
}
