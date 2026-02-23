import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateId } from "../utils/id";

export interface StorageListOptions<T> {
  defaultItems?: T[];
}

export function createStorageList<T extends { id: string }>(
  key: string,
  options: StorageListOptions<T> = {},
) {
  const { defaultItems } = options;

  async function getList(): Promise<T[]> {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      if (defaultItems?.length) {
        await AsyncStorage.setItem(key, JSON.stringify(defaultItems));
        return [...defaultItems];
      }
      return [];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return defaultItems ?? [];
    }
  }

  async function setList(items: T[]): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(items));
  }

  async function addItem(item: Omit<T, "id">): Promise<T> {
    const list = await getList();
    const id = generateId();
    const newItem = { ...item, id } as T;
    list.push(newItem);
    await setList(list);
    return newItem;
  }

  async function updateItem(id: string, updates: Partial<T>): Promise<void> {
    const list = await getList();
    const i = list.findIndex((x) => x.id === id);
    if (i === -1) return;
    list[i] = { ...list[i], ...updates };
    await setList(list);
  }

  async function deleteItem(id: string): Promise<void> {
    const list = await getList().then((arr) => arr.filter((x) => x.id !== id));
    await setList(list);
  }

  return { getList, setList, addItem, updateItem, deleteItem };
}
