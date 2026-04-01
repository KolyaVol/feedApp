import type { PlanDay } from "../types";
import {
  GITHUB_API_BASE,
  GITHUB_BRANCH,
  GITHUB_DATA_JSON_PATH,
  GITHUB_OWNER,
  GITHUB_REPO,
} from "./env";
import { loadGithubToken } from "./storage";

export type GithubSyncMeal = { product: string; amountGrams: number };

export type GithubSyncDay = {
  sequence?: number;
  weekNumber: number;
  dayNumber: number;
  morning?: GithubSyncMeal;
  lunch?: GithubSyncMeal[];
  evening?: GithubSyncMeal[];
  notes?: string;
  time?: string;
  foodType?: string;
  food?: string;
  amountGrams?: number;
  substitutions?: string[];
};

export type GithubSyncResult = {
  ok: boolean;
  text: string;
  scheduleText?: string;
  commitSha?: string;
  commitUrl?: string;
  errorCode?: "missing_config";
};

function toBase64Utf8(text: string): string | null {
  try {
    const anyGlobal = globalThis as any;
    if (anyGlobal?.Buffer?.from) return anyGlobal.Buffer.from(text, "utf8").toString("base64");
    const enc = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
    const bytes = enc ? enc.encode(text) : null;
    if (!bytes) return null;
    const table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
      const a = bytes[i] ?? 0;
      const b = bytes[i + 1] ?? 0;
      const c = bytes[i + 2] ?? 0;
      const triple = (a << 16) | (b << 8) | c;
      out += table[(triple >> 18) & 63]!;
      out += table[(triple >> 12) & 63]!;
      out += i + 1 < bytes.length ? table[(triple >> 6) & 63]! : "=";
      out += i + 2 < bytes.length ? table[triple & 63]! : "=";
    }
    return out;
  } catch {
    return null;
  }
}

function fromBase64Utf8(base64: string): string | null {
  try {
    const anyGlobal = globalThis as any;
    if (anyGlobal?.Buffer?.from) return anyGlobal.Buffer.from(base64, "base64").toString("utf8");
    if (typeof atob !== "undefined") {
      const binary = atob(base64);
      if (typeof TextDecoder !== "undefined") {
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new TextDecoder().decode(bytes);
      }
      return binary;
    }
    return null;
  } catch {
    return null;
  }
}

function jsonString(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function githubPathEncode(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

async function readGithubContentsSha(opts: {
  apiBase: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
  token: string;
}): Promise<{ sha?: string; text?: string; notFound: boolean }> {
  const url =
    `${opts.apiBase.replace(/\/+$/, "")}` +
    `/repos/${encodeURIComponent(opts.owner)}/${encodeURIComponent(opts.repo)}` +
    `/contents/${githubPathEncode(opts.path)}?ref=${encodeURIComponent(opts.branch)}&t=${Date.now()}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${opts.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (res.status === 404) return { sha: undefined, text: undefined, notFound: true };
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub GET contents failed (${res.status}): ${text || res.statusText}`);
  }
  const json = (await res.json()) as any;
  const sha = json?.sha;
  const contentRaw = typeof json?.content === "string" ? json.content : "";
  const content = contentRaw.replace(/\n/g, "");
  const text = content ? fromBase64Utf8(content) ?? undefined : undefined;
  return { sha: typeof sha === "string" ? sha : undefined, text, notFound: false };
}

async function putGithubContents(opts: {
  apiBase: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
  token: string;
  message: string;
  contentBase64: string;
  sha?: string;
}): Promise<{ commitUrl?: string; commitSha?: string }> {
  const url =
    `${opts.apiBase.replace(/\/+$/, "")}` +
    `/repos/${encodeURIComponent(opts.owner)}/${encodeURIComponent(opts.repo)}` +
    `/contents/${githubPathEncode(opts.path)}`;
  const body: Record<string, unknown> = {
    message: opts.message,
    content: opts.contentBase64,
    branch: opts.branch,
  };
  if (opts.sha) body.sha = opts.sha;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${opts.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub PUT contents failed (${res.status}): ${text || res.statusText}`);
  }
  const json = (await res.json()) as any;
  const commitSha = typeof json?.commit?.sha === "string" ? json.commit.sha : undefined;
  const commitUrl = typeof json?.commit?.html_url === "string" ? json.commit.html_url : undefined;
  return { commitSha, commitUrl };
}

function isGithubConflictError(error: unknown): boolean {
  const msg = String((error as any)?.message ?? error ?? "");
  return /\(409\)|\b409\b|Conflict/i.test(msg);
}

function mergeMonthData(root: any, month: number, syncDays: GithubSyncDay[]): any {
  const byWeekDay = new Map<string, GithubSyncDay>();
  const bySequence = new Map<number, GithubSyncDay>();
  for (const day of syncDays) byWeekDay.set(`${day.weekNumber}:${day.dayNumber}`, day);
  for (const day of syncDays) {
    if (typeof day.sequence === "number") bySequence.set(day.sequence, day);
  }

  const applyToMonth = (monthNode: any) => {
    if (!monthNode || typeof monthNode !== "object") return;

    if (Array.isArray(monthNode.introduction_plan)) {
      let seq = 0;
      for (const weekNode of monthNode.introduction_plan) {
        if (!weekNode || typeof weekNode !== "object" || !Array.isArray(weekNode.days)) continue;
        const weekNo = Number(weekNode.week);
        for (const dayNode of weekNode.days) {
          if (!dayNode || typeof dayNode !== "object") continue;
          const dayNo = Number(dayNode.day);
          const syncDay = bySequence.get(seq) ?? byWeekDay.get(`${weekNo}:${dayNo}`);
          seq += 1;
          if (!syncDay) continue;
          if (syncDay.morning) {
            dayNode.morning = { product: syncDay.morning.product, amount_grams: syncDay.morning.amountGrams };
          }
          if (syncDay.lunch) {
            dayNode.lunch = syncDay.lunch.map((m) => ({ product: m.product, amount_grams: m.amountGrams }));
          }
          if (syncDay.evening) {
            dayNode.evening = syncDay.evening.map((m) => ({ product: m.product, amount_grams: m.amountGrams }));
          }
          if ("notes" in syncDay) dayNode.notes = syncDay.notes ?? "";
        }
      }
    }

    if (Array.isArray(monthNode.weekly_schedule)) {
      let seq = 0;
      for (const weekNode of monthNode.weekly_schedule) {
        if (!weekNode || typeof weekNode !== "object" || !Array.isArray(weekNode.days)) continue;
        const weekNo = Number(weekNode.week);
        for (const dayNode of weekNode.days) {
          if (!dayNode || typeof dayNode !== "object") continue;
          const dayNo = Number(dayNode.day);
          const syncDay = bySequence.get(seq) ?? byWeekDay.get(`${weekNo}:${dayNo}`);
          seq += 1;
          if (!syncDay) continue;
          if (syncDay.time !== undefined) dayNode.time = syncDay.time;
          if (syncDay.foodType !== undefined) dayNode.food_type = syncDay.foodType;
          if (syncDay.food !== undefined) dayNode.food = syncDay.food;
          if (syncDay.amountGrams !== undefined) dayNode.amount_grams = syncDay.amountGrams;
          if (syncDay.substitutions !== undefined) dayNode.substitutions = syncDay.substitutions.length ? syncDay.substitutions : undefined;
          if ("notes" in syncDay) dayNode.notes = syncDay.notes || undefined;
        }
      }
    }
  };

  const nextRoot = JSON.parse(JSON.stringify(root));
  if (Array.isArray(nextRoot?.months)) {
    const target = nextRoot.months.find((m: any) => Number(m?.month) === month);
    if (target) applyToMonth(target);
  } else if (Number(nextRoot?.month) === month) {
    applyToMonth(nextRoot);
  }
  return nextRoot;
}

type MealDraftMeta = { notes: string; lunchFood: string; lunchAmount: string; eveningFood: string; eveningAmount: string };

export function parseMealMeta(notes?: string): MealDraftMeta {
  const raw = notes ?? "";
  const lines = raw.split("\n");
  let lunchFood = "";
  let lunchAmount = "";
  let eveningFood = "";
  let eveningAmount = "";
  const clean: string[] = [];
  for (const line of lines) {
    if (line.startsWith("__lunch=")) {
      const [f, a] = line.replace("__lunch=", "").split("|");
      lunchFood = (f ?? "").trim();
      lunchAmount = (a ?? "").trim();
      continue;
    }
    if (line.startsWith("__evening=")) {
      const [f, a] = line.replace("__evening=", "").split("|");
      eveningFood = (f ?? "").trim();
      eveningAmount = (a ?? "").trim();
      continue;
    }
    clean.push(line);
  }
  return { notes: clean.join("\n").trim(), lunchFood, lunchAmount, eveningFood, eveningAmount };
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function mapPlanDaysToGithubSyncDays(
  days: PlanDay[],
  amountTextById: Record<string, string>,
  subsTextById: Record<string, string>,
): GithubSyncDay[] {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const dayNumberById = new Map<string, number>();
  const byWeek = new Map<number, PlanDay[]>();
  for (const day of sorted) {
    const list = byWeek.get(day.weekNumber) ?? [];
    list.push(day);
    byWeek.set(day.weekNumber, list);
  }
  for (const [_, list] of byWeek) {
    list.sort((a, b) => a.date.localeCompare(b.date)).forEach((d, idx) => dayNumberById.set(d.id, idx + 1));
  }
  return sorted.map((day, sequence) => {
    const amountTxt = amountTextById[day.id] ?? String(day.amountGrams);
    const amountParsed = parseInt(amountTxt || "0", 10);
    const subsTxt = subsTextById[day.id] ?? day.substitutions.join(", ");
    const parsedMeta = parseMealMeta(day.notes);
    const lunchFoods = splitCsv(parsedMeta.lunchFood);
    const lunchAmounts = splitCsv(parsedMeta.lunchAmount);
    const eveningFoods = splitCsv(parsedMeta.eveningFood);
    const eveningAmounts = splitCsv(parsedMeta.eveningAmount);
    return {
      sequence,
      weekNumber: day.weekNumber,
      dayNumber: dayNumberById.get(day.id) ?? 1,
      morning: {
        product: day.food,
        amountGrams: isNaN(amountParsed) ? 0 : amountParsed,
      },
      lunch: lunchFoods.map((product, idx) => ({
        product,
        amountGrams: parseInt(lunchAmounts[idx] ?? "0", 10) || 0,
      })),
      evening: eveningFoods.map((product, idx) => ({
        product,
        amountGrams: parseInt(eveningAmounts[idx] ?? "0", 10) || 0,
      })),
      notes: parsedMeta.notes || "",
      time: day.time,
      foodType: day.foodType,
      food: day.food,
      amountGrams: isNaN(amountParsed) ? 0 : amountParsed,
      substitutions: subsTxt
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
  });
}

export async function syncMonthToGithub(params: {
  month: number;
  days: GithubSyncDay[];
  message: string;
}): Promise<GithubSyncResult> {
  const token = (await loadGithubToken()).trim();
  const owner = GITHUB_OWNER.trim();
  const repo = GITHUB_REPO.trim();
  const branch = GITHUB_BRANCH.trim();
  const path = GITHUB_DATA_JSON_PATH.trim();
  const apiBase = GITHUB_API_BASE.trim();

  const missingRequired: string[] = [];
  if (!token) missingRequired.push("GITHUB_TOKEN");
  if (!owner) missingRequired.push("GITHUB_OWNER");
  if (!repo) missingRequired.push("GITHUB_REPO");

  if (missingRequired.length > 0) {
    return {
      ok: false,
      text:
        `Missing config.\n` +
        `Need: ${missingRequired.join(", ")} in Settings\n` +
        `Open Settings and set GitHub token`,
      errorCode: "missing_config",
    };
  }

  try {
    const current = await readGithubContentsSha({ apiBase, owner, repo, branch, path, token });
    if (current.notFound || !current.text) return { ok: false, text: "Target JSON file not found on GitHub." };
    let rootJson: any;
    try {
      rootJson = JSON.parse(current.text);
    } catch {
      return { ok: false, text: "Current GitHub JSON is invalid and cannot be merged safely." };
    }
    const merged = mergeMonthData(rootJson, params.month, params.days);
    const mergedText = jsonString(merged);
    const contentBase64 = toBase64Utf8(mergedText);
    if (!contentBase64) return { ok: false, text: "Base64 encoding is unavailable (globalThis.btoa missing)." };

    let nextSha = current.sha;
    let nextBase64 = contentBase64;
    let put: { commitUrl?: string; commitSha?: string } | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        put = await putGithubContents({
          apiBase,
          owner,
          repo,
          branch,
          path,
          token,
          message: `${params.message} (${path})`,
          contentBase64: nextBase64,
          sha: nextSha,
        });
        break;
      } catch (error) {
        lastError = error;
        if (!isGithubConflictError(error) || attempt === 2) break;
        const latest = await readGithubContentsSha({ apiBase, owner, repo, branch, path, token });
        if (latest.notFound || !latest.text) break;
        const latestRoot = JSON.parse(latest.text);
        const latestMerged = mergeMonthData(latestRoot, params.month, params.days);
        const latestBase64 = toBase64Utf8(jsonString(latestMerged));
        if (!latestBase64) break;
        nextSha = latest.sha;
        nextBase64 = latestBase64;
      }
    }

    if (!put) throw lastError ?? new Error("GitHub PUT failed");
    return {
      ok: true,
      text: "Synced to GitHub",
      scheduleText: mergedText,
      commitSha: put.commitSha,
      commitUrl: put.commitUrl,
    };
  } catch (error) {
    return { ok: false, text: String((error as any)?.message ?? error) };
  }
}
