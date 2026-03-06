export interface QueryResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface OpenAIAuthData {
  type: string;
  access?: string;
  refresh?: string;
  expires?: number;
}

export interface ZhipuAuthData {
  type: string;
  key?: string;
}

export interface CopilotAuthData {
  type: string;
  refresh?: string;
  access?: string;
  expires?: number;
}

export interface AnthropicAuthData {
  type: "oauth" | "api" | "wellknown";
  access?: string;
  refresh?: string;
  expires?: number;
  key?: string;
  token?: string;
}

export type CopilotTier = "free" | "pro" | "pro+" | "business" | "enterprise";

export interface CopilotQuotaConfig {
  token: string;
  username: string;
  tier: CopilotTier;
}

export interface AntigravityAccount {
  email?: string;
  refreshToken: string;
  projectId?: string;
  managedProjectId?: string;
  addedAt: number;
  lastUsed: number;
  rateLimitResetTimes?: Record<string, number>;
}

export interface AntigravityAccountsFile {
  version: number;
  accounts: AntigravityAccount[];
}

export interface AuthData {
  openai?: OpenAIAuthData;
  "zhipuai-coding-plan"?: ZhipuAuthData;
  "zai-coding-plan"?: ZhipuAuthData;
  "github-copilot"?: CopilotAuthData;
  anthropic?: AnthropicAuthData;
}

export const HIGH_USAGE_THRESHOLD = 80;
export const REQUEST_TIMEOUT_MS = 10000;
