import { readAuthData } from "../core/auth";
import type { PlatformStatus } from "../core/query";
import { queryAllPlatforms } from "../core/query";

export type RefreshInterval = 10 | 30 | 60;

export interface AppState {
  statuses: PlatformStatus[];
  lastUpdatedAt: number | null;
  loading: boolean;
  error?: string;
}

export async function fetchStatuses(): Promise<AppState> {
  try {
    const authData = await readAuthData();
    const statuses = await queryAllPlatforms(authData);
    return {
      statuses,
      lastUpdatedAt: Date.now(),
      loading: false,
    };
  } catch (err) {
    return {
      statuses: [],
      lastUpdatedAt: Date.now(),
      loading: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
