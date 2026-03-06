import type { AuthData, QueryResult } from "./types";
import { queryOpenAIUsage } from "../platforms/openai";
import { queryZaiUsage, queryZhipuUsage } from "../platforms/zhipu";
import { queryGoogleUsage } from "../platforms/google";
import { queryCopilotUsage } from "../platforms/copilot";

export type PlatformKey = "openai" | "zhipu" | "zai" | "google" | "copilot";

export interface PlatformStatus {
  key: PlatformKey;
  title: string;
  result: QueryResult | null;
}

export async function queryAllPlatforms(authData: AuthData): Promise<PlatformStatus[]> {
  const [openaiResult, zhipuResult, zaiResult, googleResult, copilotResult] =
    await Promise.all([
      queryOpenAIUsage(authData.openai),
      queryZhipuUsage(authData["zhipuai-coding-plan"]),
      queryZaiUsage(authData["zai-coding-plan"]),
      queryGoogleUsage(),
      queryCopilotUsage(authData["github-copilot"]),
    ]);

  return [
    { key: "openai", title: "OpenAI Account Quota", result: openaiResult },
    { key: "zhipu", title: "Zhipu AI Account Quota", result: zhipuResult },
    { key: "zai", title: "Z.ai Account Quota", result: zaiResult },
    { key: "copilot", title: "GitHub Copilot Account Quota", result: copilotResult },
    { key: "google", title: "Google Cloud Account Quota", result: googleResult },
  ];
}
