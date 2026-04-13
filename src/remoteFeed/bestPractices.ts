import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BestPracticesData } from "../types";
import { KEYS } from "../data/storageKeys";
import {
  GITHUB_API_BASE,
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_BRANCH,
} from "./env";

const BEST_PRACTICES_PATH = "best-practices.json";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function fromBase64(b64: string): string {
  const g = globalThis as any;
  if (g?.Buffer?.from) {
    return g.Buffer.from(b64, "base64").toString("utf8");
  }
  if (typeof g?.atob === "function") {
    const binary = g.atob(b64.replace(/\s/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }
  const cleaned = b64.replace(/\s/g, "");
  const table =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i += 4) {
    const a = table.indexOf(cleaned[i]!);
    const b = table.indexOf(cleaned[i + 1]!);
    const cChar = cleaned[i + 2]!;
    const dChar = cleaned[i + 3]!;
    const c = cChar === "=" ? 0 : table.indexOf(cChar);
    const d = dChar === "=" ? 0 : table.indexOf(dChar);
    const triple = (a << 18) | (b << 12) | (c << 6) | d;
    bytes.push((triple >> 16) & 255);
    if (cChar !== "=") bytes.push((triple >> 8) & 255);
    if (dChar !== "=") bytes.push(triple & 255);
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function isValidBestPractices(v: unknown): v is BestPracticesData {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  return Array.isArray(obj.safetyTips) && Array.isArray(obj.sections);
}

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
    return isValidBestPractices(parsed) ? parsed : null;
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
    if (!isValidBestPractices(parsed)) {
      return { ok: false, data: null, text: "Invalid best practices format." };
    }
    await saveCache(parsed);
    return { ok: true, data: parsed, text: "Fetched successfully." };
  } catch (e: any) {
    const cached = await loadCache();
    if (cached) return { ok: true, data: cached, text: "Using stale cache." };
    return { ok: false, data: null, text: e?.message ?? "Fetch failed." };
  }
}
