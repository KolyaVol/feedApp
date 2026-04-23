import type { FeedDay } from "../types";
import { getGithubToken, setLastSyncAt } from "../data/settings";
import { parseFeedDaysStrict } from "../data/schemas";
import {
  GITHUB_BRANCH,
  GITHUB_USER_JSON_PATH,
} from "./env";
import {
  getAuthoritativeFileSha,
  getFileContent,
  putFileContents,
  toBase64,
} from "./githubClient";

export interface SyncResult {
  ok: boolean;
  text: string;
  days?: FeedDay[];
  conflict?: boolean;
}

function jsonifyDays(days: FeedDay[]): string {
  return JSON.stringify(days, null, 2);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientStatus(status: number | undefined): boolean {
  if (!status) return true;
  if (status >= 500 && status <= 599) return true;
  if (status === 429) return true;
  return false;
}

let current: Promise<SyncResult> | null = null;
let pending: FeedDay[] | null = null;

export async function pushFeedDays(days: FeedDay[]): Promise<SyncResult> {
  if (current) {
    pending = days;
    return current;
  }
  current = runPushLoop(days);
  try {
    return await current;
  } finally {
    current = null;
    if (pending) {
      const next = pending;
      pending = null;
      void pushFeedDays(next);
    }
  }
}

async function runPushLoop(days: FeedDay[]): Promise<SyncResult> {
  const token = await getGithubToken();
  if (!token) return { ok: false, text: "GitHub token not configured." };

  const body = jsonifyDays(days);
  const contentBase64 = toBase64(body);
  const message = `Update feed data ${new Date().toISOString().slice(0, 10)}`;

  const shaRes = await getAuthoritativeFileSha(GITHUB_BRANCH, GITHUB_USER_JSON_PATH);
  if (!shaRes.ok) {
    if (isTransientStatus(shaRes.status)) {
      await sleep(1500);
      const retry = await getAuthoritativeFileSha(GITHUB_BRANCH, GITHUB_USER_JSON_PATH);
      if (!retry.ok) {
        return { ok: false, text: `Cannot read remote sha: ${retry.message ?? "unknown"}` };
      }
      return performPut(retry.data!.sha, contentBase64, message);
    }
    return { ok: false, text: `Cannot read remote sha: ${shaRes.message ?? "unknown"}` };
  }

  return performPut(shaRes.data!.sha, contentBase64, message);
}

async function performPut(
  sha: string | null,
  contentBase64: string,
  message: string,
): Promise<SyncResult> {
  let attempt = 0;
  let currentSha = sha;

  while (attempt < 3) {
    attempt += 1;
    const putRes = await putFileContents({
      path: GITHUB_USER_JSON_PATH,
      branch: GITHUB_BRANCH,
      contentBase64,
      sha: currentSha,
      message,
    });

    if (putRes.ok) {
      await setLastSyncAt(new Date().toISOString());
      return { ok: true, text: "Pushed successfully." };
    }

    if (putRes.status === 409 || putRes.status === 422) {
      if (attempt >= 2) {
        return {
          ok: false,
          conflict: true,
          text: `Push conflict: ${putRes.message ?? "sha mismatch"}`,
        };
      }
      const refreshed = await getAuthoritativeFileSha(GITHUB_BRANCH, GITHUB_USER_JSON_PATH);
      if (!refreshed.ok) {
        return { ok: false, text: `Cannot refresh sha: ${refreshed.message ?? "unknown"}` };
      }
      currentSha = refreshed.data!.sha;
      continue;
    }

    if (isTransientStatus(putRes.status)) {
      if (attempt >= 3) {
        return { ok: false, text: `Push failed (${putRes.status ?? "net"}): ${putRes.message ?? "transient error"}` };
      }
      await sleep(500 * Math.pow(2, attempt - 1));
      continue;
    }

    return { ok: false, text: `Push failed (${putRes.status ?? "?"}): ${putRes.message ?? "unknown"}` };
  }

  return { ok: false, text: "Push failed: retries exhausted" };
}

export async function pullFeedDays(): Promise<SyncResult> {
  const res = await getFileContent(GITHUB_USER_JSON_PATH, GITHUB_BRANCH);
  if (!res.ok) {
    if (res.status === 404) return { ok: true, text: "No remote data found.", days: [] };
    return { ok: false, text: `Pull failed (${res.status ?? "net"}): ${res.message ?? "unknown"}` };
  }
  try {
    const parsed = JSON.parse(res.data!.text) as unknown;
    const validation = parseFeedDaysStrict(parsed);
    if (!validation.ok) {
      return { ok: false, text: `Remote data invalid: ${validation.message}` };
    }
    await setLastSyncAt(new Date().toISOString());
    return { ok: true, text: "Pulled successfully.", days: validation.days };
  } catch (e: any) {
    return { ok: false, text: `Invalid remote JSON: ${e?.message ?? "parse error"}` };
  }
}
