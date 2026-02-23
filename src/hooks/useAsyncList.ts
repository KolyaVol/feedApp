import { useCallback, useEffect, useState } from "react";

export interface UseAsyncListConfig<T extends { id: string }> {
  fetch: () => Promise<T[]>;
  add?: (item: Omit<T, "id">) => Promise<T>;
  update?: (id: string, updates: Partial<T>) => Promise<void>;
  remove?: (id: string) => Promise<void>;
}

export function useAsyncList<T extends { id: string }>({
  fetch: fetchList,
  add: addItem,
  update: updateItem,
  remove: removeItem,
}: UseAsyncListConfig<T>): {
  items: T[];
  loading: boolean;
  refresh: () => Promise<void>;
  add: ((item: Omit<T, "id">) => Promise<T>) | undefined;
  update: ((id: string, updates: Partial<T>) => Promise<void>) | undefined;
  remove: ((id: string) => Promise<void>) | undefined;
} {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await fetchList();
    setItems(list);
    setLoading(false);
  }, [fetchList]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (item: Omit<T, "id">): Promise<T> => {
      if (!addItem) throw new Error("add not configured");
      const added = await addItem(item);
      await refresh();
      return added;
    },
    [addItem, refresh],
  );

  const update = useCallback(
    async (id: string, updates: Partial<T>): Promise<void> => {
      if (!updateItem) return;
      await updateItem(id, updates);
      await refresh();
    },
    [updateItem, refresh],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      if (!removeItem) return;
      await removeItem(id);
      await refresh();
    },
    [removeItem, refresh],
  );

  return {
    items,
    loading,
    refresh,
    add: addItem ? add : undefined,
    update: updateItem ? update : undefined,
    remove: removeItem ? remove : undefined,
  };
}
