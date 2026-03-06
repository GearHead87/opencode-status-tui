import type { QueryResult, ZhipuAuthData } from "../core/types";
import {
  calcRemainPercent,
  createProgressBar,
  fetchWithTimeout,
  formatDuration,
  formatTokens,
  maskString,
  safeMax,
} from "../core/utils";

interface UsageLimitItem {
  type: "TIME_LIMIT" | "TOKENS_LIMIT";
  usage: number;
  currentValue: number;
  percentage: number;
  nextResetTime?: number;
}

interface QuotaLimitResponse {
  code: number;
  msg: string;
  data: {
    limits: UsageLimitItem[];
  };
  success: boolean;
}

interface PlatformConfig {
  apiUrl: string;
  accountLabel: string;
  apiErrorLabel: string;
}

const ZHIPU_QUOTA_QUERY_URL =
  "https://bigmodel.cn/api/monitor/usage/quota/limit";
const ZAI_QUOTA_QUERY_URL = "https://api.z.ai/api/monitor/usage/quota/limit";

const ZHIPU_CONFIG: PlatformConfig = {
  apiUrl: ZHIPU_QUOTA_QUERY_URL,
  accountLabel: "Coding Plan",
  apiErrorLabel: "Zhipu AI",
};

const ZAI_CONFIG: PlatformConfig = {
  apiUrl: ZAI_QUOTA_QUERY_URL,
  accountLabel: "Z.ai",
  apiErrorLabel: "Z.ai",
};

async function fetchUsage(apiKey: string, config: PlatformConfig): Promise<QuotaLimitResponse> {
  const response = await fetchWithTimeout(config.apiUrl, {
    method: "GET",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
      "User-Agent": "OpenCode-Status-TUI/1.0",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${config.apiErrorLabel} API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as QuotaLimitResponse;
  if (!data.success || data.code !== 200) {
    throw new Error(`${config.apiErrorLabel} API error (${data.code}): ${data.msg ?? "Unknown error"}`);
  }

  return data;
}

function formatUsage(
  data: QuotaLimitResponse,
  apiKey: string,
  accountLabel: string,
): string {
  const lines: string[] = [];
  const limits = data.data.limits;

  const maskedKey = maskString(apiKey);
  lines.push(`Account:        ${maskedKey} (${accountLabel})`);
  lines.push("");

  if (!limits || limits.length === 0) {
    lines.push("No quota data available.");
    return lines.join("\n");
  }

  const tokensLimit = limits.find((l) => l.type === "TOKENS_LIMIT");
  if (tokensLimit) {
    const remainPercent = calcRemainPercent(tokensLimit.percentage);
    const progressBar = createProgressBar(remainPercent);
    lines.push("5-hour token limit");
    lines.push(`${progressBar} ${remainPercent}% remaining`);
    lines.push(
      `Used: ${formatTokens(tokensLimit.currentValue)} / ${formatTokens(tokensLimit.usage)}`,
    );
    if (tokensLimit.nextResetTime) {
      const resetSeconds = Math.max(
        0,
        Math.floor((tokensLimit.nextResetTime - Date.now()) / 1000),
      );
      lines.push(`Resets in: ${formatDuration(resetSeconds)}`);
    }
  }

  const timeLimit = limits.find((l) => l.type === "TIME_LIMIT");
  if (timeLimit) {
    if (tokensLimit) lines.push("");
    const remainPercent = calcRemainPercent(timeLimit.percentage);
    const progressBar = createProgressBar(remainPercent);
    lines.push("MCP search limit");
    lines.push(`${progressBar} ${remainPercent}% remaining`);
    lines.push(`Used: ${timeLimit.currentValue} / ${timeLimit.usage}`);
  }

  const maxPercentage = safeMax(limits.map((l) => l.percentage));
  if (maxPercentage >= 80) {
    lines.push("");
    lines.push("Limit reached");
  }

  return lines.join("\n");
}

async function queryUsage(
  authData: ZhipuAuthData | undefined,
  config: PlatformConfig,
): Promise<QueryResult | null> {
  if (!authData || authData?.type !== "api" || !authData?.key) {
    return null;
  }

  try {
    const usage = await fetchUsage(authData.key, config);
    return {
      success: true,
      output: formatUsage(usage, authData.key, config.accountLabel),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function queryZhipuUsage(
  authData: ZhipuAuthData | undefined,
): Promise<QueryResult | null> {
  return queryUsage(authData, ZHIPU_CONFIG);
}

export async function queryZaiUsage(
  authData: ZhipuAuthData | undefined,
): Promise<QueryResult | null> {
  return queryUsage(authData, ZAI_CONFIG);
}
