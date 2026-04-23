import { getGithubToken } from "../data/settings";
import {
  GITHUB_API_BASE,
  GITHUB_OWNER,
  GITHUB_REPO,
} from "./env";

export interface GithubResult<T> {
  ok: boolean;
  status?: number;
  data?: T;
  message?: string;
}

export function toBase64(text: string): string {
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

export function fromBase64(b64: string): string {
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

export function parseGithubMessage(rawText: string): string {
  if (!rawText) return "";
  try {
    const parsed = JSON.parse(rawText) as { message?: string };
    if (parsed?.message && typeof parsed.message === "string") return parsed.message;
  } catch {}
  return rawText;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getGithubToken();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function repoBase(): string {
  return `${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;
}

async function handleJson<T>(res: Response): Promise<GithubResult<T>> {
  if (res.status === 404) {
    return { ok: false, status: 404, message: "Not found" };
  }
  if (!res.ok) {
    const rawText = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      message: parseGithubMessage(rawText).slice(0, 240) || `HTTP ${res.status}`,
    };
  }
  try {
    const data = (await res.json()) as T;
    return { ok: true, status: res.status, data };
  } catch (e: any) {
    return { ok: false, status: res.status, message: e?.message ?? "Invalid JSON" };
  }
}

interface GitRefResponse {
  object: { sha: string; type: string };
}

interface GitCommitResponse {
  sha: string;
  tree: { sha: string };
}

interface GitTreeEntry {
  path: string;
  type: "blob" | "tree" | "commit";
  sha: string;
}

interface GitTreeResponse {
  sha: string;
  tree: GitTreeEntry[];
  truncated?: boolean;
}

export async function getBranchTipSha(branch: string): Promise<GithubResult<string>> {
  const headers = await authHeaders();
  const cacheBust = Date.now();
  const url = `${repoBase()}/git/ref/heads/${encodeURIComponent(branch)}?_=${cacheBust}`;
  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    const result = await handleJson<GitRefResponse>(res);
    if (!result.ok) return { ok: false, status: result.status, message: result.message };
    const sha = result.data?.object?.sha;
    if (!sha) return { ok: false, status: result.status, message: "No commit sha in ref response" };
    return { ok: true, data: sha };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "Network error reading branch ref" };
  }
}

export async function getCommitTreeSha(commitSha: string): Promise<GithubResult<string>> {
  const headers = await authHeaders();
  const url = `${repoBase()}/git/commits/${commitSha}`;
  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    const result = await handleJson<GitCommitResponse>(res);
    if (!result.ok) return { ok: false, status: result.status, message: result.message };
    const treeSha = result.data?.tree?.sha;
    if (!treeSha) return { ok: false, status: result.status, message: "No tree sha in commit response" };
    return { ok: true, data: treeSha };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "Network error reading commit" };
  }
}

export async function findFileBlobSha(
  treeSha: string,
  path: string,
): Promise<GithubResult<string | null>> {
  const headers = await authHeaders();
  const url = `${repoBase()}/git/trees/${treeSha}?recursive=1`;
  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    const result = await handleJson<GitTreeResponse>(res);
    if (!result.ok) return { ok: false, status: result.status, message: result.message };
    const tree = result.data?.tree ?? [];
    const entry = tree.find((e) => e.path === path && e.type === "blob");
    return { ok: true, data: entry?.sha ?? null };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "Network error reading tree" };
  }
}

export interface AuthoritativeShaResult {
  exists: boolean;
  sha: string | null;
}

export async function getAuthoritativeFileSha(
  branch: string,
  path: string,
): Promise<GithubResult<AuthoritativeShaResult>> {
  const refRes = await getBranchTipSha(branch);
  if (!refRes.ok) {
    if (refRes.status === 404) {
      return { ok: true, data: { exists: false, sha: null } };
    }
    return { ok: false, status: refRes.status, message: refRes.message };
  }
  const commitRes = await getCommitTreeSha(refRes.data!);
  if (!commitRes.ok) return { ok: false, status: commitRes.status, message: commitRes.message };
  const blobRes = await findFileBlobSha(commitRes.data!, path);
  if (!blobRes.ok) return { ok: false, status: blobRes.status, message: blobRes.message };
  const sha = blobRes.data ?? null;
  return { ok: true, data: { exists: sha !== null, sha } };
}

export interface PutFileArgs {
  path: string;
  branch: string;
  contentBase64: string;
  sha: string | null;
  message: string;
}

export interface PutFileResponse {
  content: { sha: string; path: string };
  commit: { sha: string };
}

export async function putFileContents(
  args: PutFileArgs,
): Promise<GithubResult<PutFileResponse>> {
  const headers = await authHeaders();
  headers["Content-Type"] = "application/json";
  const url = `${repoBase()}/contents/${args.path}`;
  const body: Record<string, string> = {
    message: args.message,
    content: args.contentBase64,
    branch: args.branch,
  };
  if (args.sha) body.sha = args.sha;
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return await handleJson<PutFileResponse>(res);
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "Network error on PUT" };
  }
}

export interface FileContentResult {
  text: string;
  sha: string;
}

interface ContentsFileResponse {
  sha: string;
  content: string;
  encoding: string;
}

export async function getFileContent(
  path: string,
  branch: string,
): Promise<GithubResult<FileContentResult>> {
  const headers = await authHeaders();
  const cacheBust = Date.now();
  const url = `${repoBase()}/contents/${path}?ref=${encodeURIComponent(branch)}&_=${cacheBust}`;
  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    const result = await handleJson<ContentsFileResponse>(res);
    if (!result.ok) return { ok: false, status: result.status, message: result.message };
    const data = result.data!;
    if (!data.content) {
      return { ok: false, status: result.status, message: "Empty remote content" };
    }
    const text = fromBase64(data.content);
    return { ok: true, data: { text, sha: data.sha } };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "Network error reading contents" };
  }
}
