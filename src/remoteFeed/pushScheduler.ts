import type { FeedDay } from "../types";
import { pushFeedDays, type SyncResult } from "./sync";

export interface PushSchedulerOptions {
  debounceMs: number;
  cooldownMs: number;
  maxConsecutiveFailures: number;
  getToken: () => Promise<string>;
  getSnapshot: () => { days: FeedDay[]; snapshot: string };
  onSyncingChange: (syncing: boolean) => void;
  onError: (text: string, conflict?: boolean) => void;
  shouldShowError: (failureCount: number, manual: boolean) => boolean;
}

export class PushScheduler {
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private failureCount = 0;
  private cooldownUntil = 0;
  private pushing = false;
  private skipNextAutoPush = false;
  private lastPushedSnapshot = "";

  constructor(private readonly opts: PushSchedulerOptions) {}

  setInitialSnapshot(snapshot: string): void {
    this.lastPushedSnapshot = snapshot;
  }

  requestSkipNextAutoPush(): void {
    this.skipNextAutoPush = true;
  }

  markSnapshotPushed(snapshot: string): void {
    this.lastPushedSnapshot = snapshot;
    this.failureCount = 0;
    this.cooldownUntil = 0;
  }

  notifyChange(snapshot: string): void {
    if (this.skipNextAutoPush) {
      this.skipNextAutoPush = false;
      this.lastPushedSnapshot = snapshot;
      return;
    }
    if (snapshot === this.lastPushedSnapshot) return;
    if (this.failureCount >= this.opts.maxConsecutiveFailures) return;

    if (this.timeout) clearTimeout(this.timeout);
    const delay = Math.max(
      this.opts.debounceMs,
      this.cooldownUntil - Date.now(),
    );
    this.timeout = setTimeout(() => {
      this.timeout = null;
      if (this.pushing) return;
      const { snapshot: latest } = this.opts.getSnapshot();
      if (latest === this.lastPushedSnapshot) return;
      void this.runPush(false);
    }, delay);
  }

  async pushNow(): Promise<SyncResult> {
    this.failureCount = 0;
    this.cooldownUntil = 0;
    return this.runPush(true);
  }

  reset(): void {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = null;
    this.failureCount = 0;
    this.cooldownUntil = 0;
  }

  private async runPush(manual: boolean): Promise<SyncResult> {
    if (this.pushing) {
      return { ok: false, text: "Push already in progress." };
    }
    const token = await this.opts.getToken();
    if (!token) return { ok: false, text: "GitHub token not configured." };

    this.pushing = true;
    this.opts.onSyncingChange(true);
    const snapshotBeforePush = this.opts.getSnapshot().snapshot;
    try {
      const result = await pushFeedDays(this.opts.getSnapshot().days);
      if (result.ok) {
        this.lastPushedSnapshot = snapshotBeforePush;
        this.failureCount = 0;
        this.cooldownUntil = 0;
      } else {
        this.failureCount += 1;
        this.cooldownUntil = Date.now() + this.opts.cooldownMs;
        if (this.opts.shouldShowError(this.failureCount, manual)) {
          this.opts.onError(result.text, result.conflict);
        }
      }
      return result;
    } finally {
      this.pushing = false;
      this.opts.onSyncingChange(false);
    }
  }
}
