import type { OpenAIAuthData, QueryResult } from "../core/types";
import { calcRemainPercent, createProgressBar, fetchWithTimeout, formatDuration } from "../core/utils";

interface RateLimitWindow {
  used_percent: number;
  limit_window_seconds: number;
  reset_after_seconds: number;
}

interface OpenAIUsageResponse {
  plan_type: string;
  rate_limit: {
    limit_reached: boolean;
    primary_window: RateLimitWindow;
    secondary_window: RateLimitWindow | null;
  } | null;
}

interface JwtPayload {
  "https://api.openai.com/profile"?: {
    email?: string;
  };
  "https://api.openai.com/auth"?: {
    chatgpt_account_id?: string;
  };
}

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLen);
  return Buffer.from(padded, "base64").toString("utf8");
}

function parseJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payloadJson = base64UrlDecode(parts[1] ?? "");
    return JSON.parse(payloadJson) as JwtPayload;
  } catch {
    return null;
  }
}

function getEmailFromJwt(token: string): string | null {
  const payload = parseJwt(token);
  return payload?.["https://api.openai.com/profile"]?.email ?? null;
}

function getAccountIdFromJwt(token: string): string | null {
  const payload = parseJwt(token);
  return payload?.["https://api.openai.com/auth"]?.chatgpt_account_id ?? null;
}

function formatWindowName(seconds: number): string {
  const days = Math.round(seconds / 86400);
  if (days >= 1) {
    return `${days}-day limit`;
  }
  return `${Math.round(seconds / 3600)}-hour limit`;
}

function formatWindow(window: RateLimitWindow): string[] {
  const windowName = formatWindowName(window.limit_window_seconds);
  const remainPercent = calcRemainPercent(window.used_percent);
  const progressBar = createProgressBar(remainPercent);
  const resetTime = formatDuration(window.reset_after_seconds);

  return [
    windowName,
    `${progressBar} ${remainPercent}% remaining`,
    `Resets in: ${resetTime}`,
  ];
}

const OPENAI_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

async function fetchOpenAIUsage(accessToken: string): Promise<OpenAIUsageResponse> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "User-Agent": "OpenCode-Status-TUI/1.0",
  };

  const accountId = getAccountIdFromJwt(accessToken);
  if (accountId) {
    headers["ChatGPT-Account-Id"] = accountId;
  }

  const response = await fetchWithTimeout(OPENAI_USAGE_URL, { headers });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<OpenAIUsageResponse>;
}

function formatOpenAIUsage(data: OpenAIUsageResponse, email: string | null): string {
  const { plan_type, rate_limit } = data;
  const lines: string[] = [];

  const accountDisplay = email ?? "unknown";
  lines.push(`Account:        ${accountDisplay} (${plan_type})`);
  lines.push("");

  if (rate_limit?.primary_window) {
    lines.push(...formatWindow(rate_limit.primary_window));
  }

  if (rate_limit?.secondary_window) {
    lines.push("");
    lines.push(...formatWindow(rate_limit.secondary_window));
  }

  if (rate_limit?.limit_reached) {
    lines.push("");
    lines.push("Limit reached");
  }

  return lines.join("\n");
}

export async function queryOpenAIUsage(
  authData: OpenAIAuthData | undefined,
): Promise<QueryResult | null> {
  if (!authData || authData?.type !== "oauth" || !authData?.access) {
    return null;
  }

  if (authData.expires && authData.expires < Date.now()) {
    return {
      success: false,
      error: "OpenAI token expired. Re-authenticate with OpenCode.",
    };
  }

  try {
    const email = getEmailFromJwt(authData.access);
    const usage = await fetchOpenAIUsage(authData.access);
    return {
      success: true,
      output: formatOpenAIUsage(usage, email),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
