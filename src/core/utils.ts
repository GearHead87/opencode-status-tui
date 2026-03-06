import { REQUEST_TIMEOUT_MS } from "./types";

export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

export function createProgressBar(remainPercent: number, width = 30): string {
  const safePercent = Math.max(0, Math.min(100, remainPercent));
  const filled = Math.round((safePercent / 100) * width);
  const empty = width - filled;
  const filledChar = "█";
  const emptyChar = "░";
  return filledChar.repeat(filled) + emptyChar.repeat(empty);
}

export function calcRemainPercent(usedPercent: number): number {
  return Math.round(100 - usedPercent);
}

export function formatTokens(tokens: number): string {
  return (tokens / 1000000).toFixed(1) + "M";
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function safeMax(arr: number[]): number {
  if (arr.length === 0) return 0;
  return Math.max(...arr);
}

export function maskString(str: string, showChars = 4): string {
  if (str.length <= showChars * 2) {
    return str;
  }
  return `${str.slice(0, showChars)}****${str.slice(-showChars)}`;
}
