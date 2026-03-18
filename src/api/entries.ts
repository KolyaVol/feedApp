import type { FeedEntry } from "../types";
import { request } from "./client";

export async function getEntries(): Promise<FeedEntry[]> {
  return request<FeedEntry[]>("GET", "/api/entries");
}

export async function addEntry(entry: Omit<FeedEntry, "id"> & { id: string }): Promise<FeedEntry> {
  return request<FeedEntry>("POST", "/api/entries", entry);
}

export async function updateEntry(id: string, updates: Partial<Omit<FeedEntry, "id">>): Promise<void> {
  await request("PATCH", `/api/entries/${encodeURIComponent(id)}`, updates);
}

export async function deleteEntry(id: string): Promise<void> {
  await request("DELETE", `/api/entries/${encodeURIComponent(id)}`);
}
