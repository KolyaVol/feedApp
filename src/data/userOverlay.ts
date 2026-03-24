import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MealType, ShiftOperation, UserOverlayState } from "../types";
import { KEYS } from "./storageKeys";
import { generateId } from "../utils/id";

const SCHEMA_VERSION = 1;

function nowIso(): string {
  return new Date().toISOString();
}

function emptyOverlay(): UserOverlayState {
  return {
    schemaVersion: SCHEMA_VERSION,
    shifts: [],
    eatenMealsByDate: {},
    replacementsByDate: {},
    updatedAt: nowIso(),
  };
}

function sanitize(raw: unknown): UserOverlayState {
  if (!raw || typeof raw !== "object") return emptyOverlay();
  const src = raw as Partial<UserOverlayState>;
  const shifts = Array.isArray(src.shifts)
    ? src.shifts.filter((x): x is ShiftOperation => {
        return (
          !!x &&
          typeof x === "object" &&
          typeof x.id === "string" &&
          (x.mode === "mealType" || x.mode === "product") &&
          (x.mealType === "morning" || x.mealType === "lunch" || x.mealType === "evening") &&
          typeof x.shiftDays === "number" &&
          Number.isFinite(x.shiftDays) &&
          x.shiftDays !== 0
        );
      })
    : [];
  const eatenMealsByDate =
    src.eatenMealsByDate && typeof src.eatenMealsByDate === "object"
      ? (src.eatenMealsByDate as UserOverlayState["eatenMealsByDate"])
      : {};
  const replacementsByDate =
    src.replacementsByDate && typeof src.replacementsByDate === "object"
      ? (src.replacementsByDate as UserOverlayState["replacementsByDate"])
      : {};
  return {
    schemaVersion: SCHEMA_VERSION,
    shifts,
    eatenMealsByDate,
    replacementsByDate,
    updatedAt: typeof src.updatedAt === "string" ? src.updatedAt : nowIso(),
  };
}

export async function getUserOverlay(): Promise<UserOverlayState> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.USER_OVERLAY);
    if (!raw) return emptyOverlay();
    const parsed = JSON.parse(raw) as unknown;
    return sanitize(parsed);
  } catch {
    return emptyOverlay();
  }
}

export async function setUserOverlay(next: UserOverlayState): Promise<void> {
  const safe = sanitize(next);
  safe.updatedAt = nowIso();
  await AsyncStorage.setItem(KEYS.USER_OVERLAY, JSON.stringify(safe));
}

export async function addShiftOperation(
  op: Omit<ShiftOperation, "id" | "createdAt">,
): Promise<UserOverlayState> {
  const state = await getUserOverlay();
  const shift: ShiftOperation = {
    ...op,
    id: generateId(),
    createdAt: nowIso(),
  };
  const next: UserOverlayState = {
    ...state,
    shifts: [...state.shifts, shift],
    updatedAt: nowIso(),
  };
  await setUserOverlay(next);
  return next;
}

export async function toggleMealEaten(
  date: string,
  mealType: MealType,
): Promise<UserOverlayState> {
  const state = await getUserOverlay();
  const current = !!state.eatenMealsByDate[date]?.[mealType];
  const nextDate = {
    ...(state.eatenMealsByDate[date] ?? {}),
    [mealType]: !current,
  };
  const next: UserOverlayState = {
    ...state,
    eatenMealsByDate: {
      ...state.eatenMealsByDate,
      [date]: nextDate,
    },
    updatedAt: nowIso(),
  };
  await setUserOverlay(next);
  return next;
}

export async function removeShiftOperation(shiftId: string): Promise<UserOverlayState> {
  const state = await getUserOverlay();
  const next: UserOverlayState = {
    ...state,
    shifts: state.shifts.filter((s) => s.id !== shiftId),
    updatedAt: nowIso(),
  };
  await setUserOverlay(next);
  return next;
}

export async function setReplacementMeal(
  date: string,
  mealType: MealType,
  product: string,
  amountGrams: number,
): Promise<UserOverlayState> {
  const state = await getUserOverlay();
  const cleanProduct = product.trim();
  const safeAmount = Number.isFinite(amountGrams) ? Math.max(0, Math.trunc(amountGrams)) : 0;
  if (!cleanProduct) return state;
  const nextDate = {
    ...(state.replacementsByDate[date] ?? {}),
    [mealType]: { product: cleanProduct, amountGrams: safeAmount },
  };
  const next: UserOverlayState = {
    ...state,
    replacementsByDate: {
      ...state.replacementsByDate,
      [date]: nextDate,
    },
    updatedAt: nowIso(),
  };
  await setUserOverlay(next);
  return next;
}

