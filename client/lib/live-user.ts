"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { HomeTab, Mode, NextDayBehavior } from "@/shared/limits";

/**
 * The latest account values this tab has changed (settings, username, photo).
 *
 * Pages get the user from the server render, which can be a little behind for a short while: the client router
 * keeps a visited page for 30 s and the server keeps a profile for 15 s (both save Firestore reads). Without this,
 * changing Sonata → Palace and coming back to Settings could show Sonata again. Every successful change is recorded
 * here (and in sessionStorage for 2 minutes, to survive a reload) and wins over older server data.
 */
export interface LiveSettings { mode: Mode; timeZone: string; nextDay: NextDayBehavior; fontScale: number; homeTab: HomeTab }
export interface Patch { settings?: Partial<LiveSettings>; username?: string; avatarVersion?: number | null; at?: number }

const KEY = "lq:live-user";
const TTL_MS = 2 * 60_000;
const subs = new Set<() => void>();

function load(): Patch {
  if (typeof window === "undefined") return {};
  try {
    const p = JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as Patch;
    return p.at && Date.now() - p.at < TTL_MS ? p : {};
  } catch {
    return {};
  }
}

let patch: Patch = load();

export function updateLiveUser(p: Omit<Patch, "at">): void {
  patch = { ...patch, ...p, settings: { ...patch.settings, ...p.settings }, at: Date.now() };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(patch));
  } catch {
    /* storage unavailable: memory only */
  }
  subs.forEach((f) => f());
}

export function clearLiveUser(): void {
  patch = {};
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

function subscribe(f: () => void) {
  subs.add(f);
  return () => subs.delete(f);
}

const EMPTY: Patch = {};
const getSnapshot = () => patch;
const getServerSnapshot = () => EMPTY;

/** The server's user with this tab's newer changes on top (pure, for tests). */
export function mergeLive<T extends { username: string; avatarVersion: number | null; settings?: LiveSettings }>(user: T, p: Patch): T {
  if (!p.at) return user;
  return {
    ...user,
    ...(p.username !== undefined ? { username: p.username } : {}),
    ...(p.avatarVersion !== undefined ? { avatarVersion: p.avatarVersion } : {}),
    ...(user.settings ? { settings: { ...user.settings, ...p.settings } } : {}),
  };
}

/** The server's user, with this tab's newer changes applied on top. */
export function useLiveUser<T extends { username: string; avatarVersion: number | null; settings?: LiveSettings }>(user: T): T {
  const p = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => mergeLive(user, p), [user, p]);
}

/** This tab's latest change to one setting, if any (outside React). */
export function liveSetting<K extends keyof LiveSettings>(key: K): LiveSettings[K] | undefined {
  return patch.at ? (patch.settings?.[key] as LiveSettings[K] | undefined) : undefined;
}

/** One setting, live: this tab's latest change, else the server value. */
export function useLiveSetting<K extends keyof LiveSettings>(key: K, server: LiveSettings[K]): LiveSettings[K] {
  const p = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (p.at && p.settings?.[key] !== undefined ? p.settings[key] : server) as LiveSettings[K];
}
