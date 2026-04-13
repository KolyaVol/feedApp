import type { FeedDay } from "../types";
import { getGithubToken, setLastSyncAt } from "../data/settings";
import {
  GITHUB_API_BASE,
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_BRANCH,
  GITHUB_USER_JSON_PATH,
} from "./env";

interface GithubFileResponse {
  sha: string;
  content: string;
  encoding: string;
}

function toBase64(text: string): string {
  const g = globalThis as any;
  if (g?.Buffer?.from) {
    return g.Buffer.from(text, "utf8").toString("base64");
  }
  const bytes = new TextEncoder().encode(text);
  const table =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const triple = (a << 16) | (b << 8) | c;
    out += table[(triple >> 18) & 63]!;
    out += table[(triple >> 12) & 63]!;
    out += i + 1 < bytes.length ? table[(triple >> 6) & 63]! : "=";
    out += i + 2 < bytes.length ? table[triple & 63]! : "=";
  }
  return out;
}

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

async function githubHeaders(): Promise<Record<string, string>> {
  const token = await getGithubToken();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) headers["Authorization"] = `token ${token}`;
  return headers;
}

async function getFileSha(): Promise<string | null> {
  try {
    const headers = await githubHeaders();
    const url = `${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_USER_JSON_PATH}?ref=${GITHUB_BRANCH}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data = (await res.json()) as GithubFileResponse;
    return data.sha ?? null;
  } catch {
    return null;
  }
}

export interface SyncResult {
  ok: boolean;
  text: string;
  days?: FeedDay[];
}

export async function pullFeedDays(): Promise<SyncResult> {
  try {
    const headers = await githubHeaders();
    const url = `${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_USER_JSON_PATH}?ref=${GITHUB_BRANCH}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      if (res.status === 404) return { ok: true, text: "No remote data found.", days: [] };
      return { ok: false, text: `GitHub error: ${res.status}` };
    }
    const data = (await res.json()) as GithubFileResponse;
    const content = fromBase64(data.content);
    const parsed = JSON.parse(content) as unknown;
    if (!Array.isArray(parsed)) {
      return { ok: false, text: "Remote data is not a valid FeedDay array." };
    }
    await setLastSyncAt(new Date().toISOString());
    return { ok: true, text: "Pulled successfully.", days: parsed as FeedDay[] };
  } catch (e: any) {
    return { ok: false, text: e?.message ?? "Pull failed." };
  }
}

export async function pushFeedDays(days: FeedDay[]): Promise<SyncResult> {
  try {
    const token = await getGithubToken();
    if (!token) return { ok: false, text: "GitHub token not configured." };

    const sha = await getFileSha();
    const content = toBase64(JSON.stringify(days, null, 2));
    const headers = await githubHeaders();
    headers["Content-Type"] = "application/json";

    const url = `${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_USER_JSON_PATH}`;
    const body: Record<string, string> = {
      message: `Update feed data ${new Date().toISOString().slice(0, 10)}`,
      content,
      branch: GITHUB_BRANCH,
    };
    if (sha) body.sha = sha;

    const res = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false, text: `Push failed (${res.status}): ${errText.slice(0, 200)}` };
    }
    await setLastSyncAt(new Date().toISOString());
    return { ok: true, text: "Pushed successfully." };
  } catch (e: any) {
    return { ok: false, text: e?.message ?? "Push failed." };
  }
}
