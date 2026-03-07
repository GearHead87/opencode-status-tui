import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import type {
  AntigravityAccount,
  AntigravityAccountsFile,
  QueryResult,
} from "../core/types";
import { createProgressBar, fetchWithTimeout, safeMax } from "../core/utils";

interface GoogleQuotaResponse {
  models: Record<
    string,
    {
      quotaInfo?: {
        remainingFraction?: number;
        resetTime?: string;
      };
    }
  >;
}

interface ModelQuota {
  displayName: string;
  remainPercent: number;
  resetTimeDisplay: string;
}

interface AccountQuotaInfo {
  email: string;
  models: ModelQuota[];
  maxUsage: number;
}

interface ModelConfig {
  key: string;
  altKey?: string;
  display: string;
}

const GOOGLE_QUOTA_API_URL =
  "https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels";
const USER_AGENT = "antigravity/1.11.9 windows/amd64";

const MODELS_TO_DISPLAY: ModelConfig[] = [
  { key: "gemini-3-pro-high", altKey: "gemini-3-pro-low", display: "G3 Pro" },
  { key: "gemini-3-pro-image", display: "G3 Image" },
  { key: "gemini-3-flash", display: "G3 Flash" },
  {
    key: "claude-opus-4-5-thinking",
    altKey: "claude-opus-4-5",
    display: "Claude",
  },
];

function getAntigravityAccountsPath(): string {
  return join(homedir(), ".config", "opencode", "antigravity-accounts.json");
}

const GOOGLE_TOKEN_REFRESH_URL = "https://oauth2.googleapis.com/token";

function getGoogleClientCredentials(): {
  clientId: string;
  clientSecret: string;
} {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET. Set them in your environment or .env file.",
    );
  }

  return { clientId, clientSecret };
}

function formatResetTimeShort(isoTime: string): string {
  if (!isoTime) return "-";

  try {
    const resetDate = new Date(isoTime);
    const now = new Date();
    const diffMs = resetDate.getTime() - now.getTime();
    if (diffMs <= 0) return "reset";
    const diffMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(diffMinutes / 1440);
    const hours = Math.floor((diffMinutes % 1440) / 60);
    const minutes = diffMinutes % 60;
    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    return `${hours}h ${minutes}m`;
  } catch {
    return "-";
  }
}

function extractModelQuotas(data: GoogleQuotaResponse): ModelQuota[] {
  const quotas: ModelQuota[] = [];
  for (const modelConfig of MODELS_TO_DISPLAY) {
    let modelInfo = data.models[modelConfig.key];
    if (!modelInfo && modelConfig.altKey) {
      modelInfo = data.models[modelConfig.altKey];
    }
    if (modelInfo) {
      const remainingFraction = modelInfo.quotaInfo?.remainingFraction ?? 0;
      quotas.push({
        displayName: modelConfig.display,
        remainPercent: Math.round(remainingFraction * 100),
        resetTimeDisplay: formatResetTimeShort(
          modelInfo.quotaInfo?.resetTime ?? "",
        ),
      });
    }
  }
  return quotas;
}

async function refreshAccessToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const { clientId, clientSecret } = getGoogleClientCredentials();

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_REFRESH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

async function fetchGoogleUsage(
  accessToken: string,
  projectId: string,
): Promise<GoogleQuotaResponse> {
  const response = await fetchWithTimeout(GOOGLE_QUOTA_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({ project: projectId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google API error (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<GoogleQuotaResponse>;
}

async function fetchAccountQuota(account: AntigravityAccount): Promise<{
  success: boolean;
  models?: ModelQuota[];
  maxUsage?: number;
  error?: string;
}> {
  try {
    const { access_token } = await refreshAccessToken(account.refreshToken);
    const projectId = account.projectId ?? account.managedProjectId;
    if (!projectId) {
      return { success: false, error: "No Google project ID found." };
    }
    const data = await fetchGoogleUsage(access_token, projectId);
    const models = extractModelQuotas(data);
    if (models.length === 0) {
      return { success: true, models: undefined, maxUsage: 0 };
    }
    const maxUsage = safeMax(models.map((m) => 100 - m.remainPercent));
    return { success: true, models, maxUsage };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function formatAccountQuota(quotaInfo: AccountQuotaInfo): string {
  const lines: string[] = [];
  lines.push(`### ${quotaInfo.email}`);
  if (quotaInfo.models.length === 0) {
    lines.push("");
    lines.push("No quota data available.");
    return lines.join("\n");
  }
  lines.push("");
  for (const model of quotaInfo.models) {
    const progressBar = createProgressBar(model.remainPercent, 20);
    lines.push(
      `${model.displayName.padEnd(10)} ${model.resetTimeDisplay.padEnd(10)} ${progressBar} ${model.remainPercent}%`,
    );
  }
  if (quotaInfo.maxUsage >= 80) {
    lines.push("");
    lines.push("Limit reached");
  }
  return lines.join("\n");
}

export async function queryGoogleUsage(): Promise<QueryResult> {
  try {
    const content = await readFile(getAntigravityAccountsPath(), "utf-8");
    const file = JSON.parse(content) as AntigravityAccountsFile;

    if (!file.accounts || file.accounts.length === 0) {
      return {
        success: true,
        output: "No quota data available.",
      };
    }

    const validAccounts = file.accounts.filter((account) => account.email);
    if (validAccounts.length === 0) {
      return {
        success: true,
        output: "No quota data available.",
      };
    }

    const results = await Promise.all(
      validAccounts.map((account) =>
        fetchAccountQuota(account).then(
          (result) => ({ account, result }) as const,
        ),
      ),
    );

    const outputs: string[] = [];
    for (const { account, result } of results) {
      if (!result.success) {
        outputs.push(`${account.email ?? "unknown"}: ${result.error}`);
      } else if (result.models && result.models.length > 0) {
        const quotaInfo: AccountQuotaInfo = {
          email: account.email ?? "unknown",
          models: result.models,
          maxUsage: result.maxUsage ?? 0,
        };
        outputs.push(formatAccountQuota(quotaInfo));
      }
    }

    if (outputs.length === 0) {
      return {
        success: true,
        output: "No quota data available.",
      };
    }

    return {
      success: true,
      output: outputs.join("\n\n"),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
