import type { AnthropicAuthData, QueryResult } from "../core/types";
import { calcRemainPercent, createProgressBar, fetchWithTimeout } from "../core/utils";

const ANTHROPIC_OAUTH_TOKEN_URL = "https://console.anthropic.com/v1/oauth/token";
const ANTHROPIC_OAUTH_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const ANTHROPIC_USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

interface AnthropicUsageWindow {
  utilization?: number;
  resets_at?: string;
}

interface AnthropicUsageResponse {
  five_hour?: AnthropicUsageWindow;
  seven_day?: AnthropicUsageWindow;
}

interface AnthropicTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

function resolveToken(authData: AnthropicAuthData): { token?: string; refreshed?: AnthropicAuthData } {
  if (authData.type === "api") {
    return { token: authData.key };
  }
  if (authData.type === "wellknown") {
    return { token: authData.token ?? authData.key };
  }
  return { token: authData.access };
}

async function refreshAccessToken(refreshToken: string): Promise<AnthropicTokenResponse> {
  const response = await fetchWithTimeout(ANTHROPIC_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: ANTHROPIC_OAUTH_CLIENT_ID,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic OAuth error (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<AnthropicTokenResponse>;
}

async function ensureOauthToken(authData: AnthropicAuthData): Promise<AnthropicAuthData> {
  if (authData.type !== "oauth") {
    return authData;
  }
  if (!authData.refresh) {
    return authData;
  }

  if (authData.access && authData.expires && authData.expires > Date.now() + TOKEN_REFRESH_BUFFER_MS) {
    return authData;
  }

  const refreshed = await refreshAccessToken(authData.refresh);
  if (!refreshed.access_token) {
    throw new Error("Failed to refresh Anthropic OAuth token.");
  }

  const expiresIn = refreshed.expires_in ?? 3600;
  const expires = Date.now() + expiresIn * 1000;

  return {
    type: "oauth",
    access: refreshed.access_token,
    refresh: refreshed.refresh_token ?? authData.refresh,
    expires,
  };
}

function resolveResetsAt(value?: string): number | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return Math.floor(date.getTime() / 1000);
}

function formatResetCountdown(resetsAt?: number): string | null {
  if (!resetsAt) return null;
  const diffMs = resetsAt * 1000 - Date.now();
  if (diffMs <= 0) return "resetting soon";
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

function formatWindow(label: string, window?: AnthropicUsageWindow): string[] {
  if (!window || typeof window.utilization !== "number") {
    return [];
  }

  const usedPercent = Math.max(0, Math.min(100, window.utilization));
  const remainPercent = calcRemainPercent(usedPercent);
  const progressBar = createProgressBar(remainPercent, 20);
  const resetLabel = formatResetCountdown(resolveResetsAt(window.resets_at));
  const lines = [`${label.padEnd(8)} ${progressBar} ${remainPercent}% remaining`];
  if (resetLabel) {
    lines.push(`Resets in: ${resetLabel}`);
  }
  return lines;
}

function formatAnthropicUsage(data: AnthropicUsageResponse): string {
  const lines: string[] = [];
  lines.push("Account:        Anthropic Claude");
  lines.push("");

  const fiveHourLines = formatWindow("5-hour", data.five_hour);
  const sevenDayLines = formatWindow("7-day", data.seven_day);

  if (fiveHourLines.length === 0 && sevenDayLines.length === 0) {
    lines.push("No quota data available.");
    return lines.join("\n");
  }

  lines.push(...fiveHourLines);
  if (fiveHourLines.length > 0 && sevenDayLines.length > 0) {
    lines.push("");
  }
  lines.push(...sevenDayLines);

  const reached = [data.five_hour?.utilization, data.seven_day?.utilization].some(
    (value) => typeof value === "number" && value >= 100,
  );
  if (reached) {
    lines.push("");
    lines.push("Limit reached");
  }

  return lines.join("\n");
}

async function fetchAnthropicUsage(token: string): Promise<AnthropicUsageResponse> {
  const response = await fetchWithTimeout(ANTHROPIC_USAGE_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "anthropic-beta": "oauth-2025-04-20",
      "User-Agent": "OpenCode-Status-TUI/1.0",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<AnthropicUsageResponse>;
}

export async function queryAnthropicUsage(
  authData: AnthropicAuthData | undefined,
): Promise<QueryResult | null> {
  if (!authData) {
    return null;
  }

  try {
    const resolvedAuth = await ensureOauthToken(authData);
    const { token } = resolveToken(resolvedAuth);
    if (!token) {
      return {
        success: false,
        error: "Anthropic authentication is required. Configure OAuth or API key.",
      };
    }

    const usage = await fetchAnthropicUsage(token);
    return {
      success: true,
      output: formatAnthropicUsage(usage),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
