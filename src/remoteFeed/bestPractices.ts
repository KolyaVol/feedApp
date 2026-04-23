import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BestPracticesData } from "../types";
import { KEYS } from "../data/storageKeys";
import { parseBestPractices } from "../data/schemas";
import { fromBase64 } from "../utils/base64";
import {
  GITHUB_API_BASE,
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_BRANCH,
} from "./env";

const BEST_PRACTICES_PATH = "best-practices.json";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

async function loadCache(): Promise<BestPracticesData | null> {
  try {
    const [raw, fetchedAt] = await Promise.all([
      AsyncStorage.getItem(KEYS.BEST_PRACTICES_CACHE),
      AsyncStorage.getItem(KEYS.BEST_PRACTICES_FETCHED_AT),
    ]);
    if (!raw || !fetchedAt) return null;
    const age = Date.now() - new Date(fetchedAt).getTime();
    if (age > CACHE_TTL_MS) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parseBestPractices(parsed);
  } catch {
    return null;
  }
}

async function saveCache(data: BestPracticesData): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.setItem(KEYS.BEST_PRACTICES_CACHE, JSON.stringify(data)),
      AsyncStorage.setItem(
        KEYS.BEST_PRACTICES_FETCHED_AT,
        new Date().toISOString(),
      ),
    ]);
  } catch {}
}

export async function fetchBestPractices(
  forceRefresh = false,
): Promise<{ ok: boolean; data: BestPracticesData | null; text: string }> {
  if (!forceRefresh) {
    const cached = await loadCache();
    if (cached) return { ok: true, data: cached, text: "Loaded from cache." };
  }

  try {
    const url = `${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${BEST_PRACTICES_PATH}?ref=${GITHUB_BRANCH}`;
    const res = await fetch(url, {
      headers: { Accept: "application/vnd.github.v3+json" },
    });
    if (!res.ok) {
      const cached = await loadCache();
      if (cached) return { ok: true, data: cached, text: "Using stale cache." };
      return { ok: false, data: null, text: `GitHub error: ${res.status}` };
    }
    const json = (await res.json()) as { content: string };
    const content = fromBase64(json.content);
    const parsed = JSON.parse(content) as unknown;
    const validated = parseBestPractices(parsed);
    if (!validated) {
      return { ok: false, data: null, text: "Invalid best practices format." };
    }
    await saveCache(validated);
    return { ok: true, data: validated, text: "Fetched successfully." };
  } catch (e: any) {
    const cached = await loadCache();
    if (cached) return { ok: true, data: cached, text: "Using stale cache." };
    return { ok: false, data: null, text: e?.message ?? "Fetch failed." };
  }
}
