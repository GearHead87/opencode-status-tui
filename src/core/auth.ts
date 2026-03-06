import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import type { AuthData, AntigravityAccountsFile } from "./types";

export function resolveAuthPath(): string {
  return join(homedir(), ".local", "share", "opencode", "auth.json");
}

export async function readAuthData(): Promise<AuthData> {
  const authPath = resolveAuthPath();
  const content = await readFile(authPath, "utf-8");
  return JSON.parse(content) as AuthData;
}

function resolveAntigravityAccountsPath(): string {
  const home = homedir();
  const configDir =
    process.platform === "win32"
      ? process.env.APPDATA ?? join(home, "AppData", "Roaming")
      : join(home, ".config");
  return join(configDir, "opencode", "antigravity-accounts.json");
}

export async function readAntigravityAccounts(): Promise<AntigravityAccountsFile> {
  const filePath = resolveAntigravityAccountsPath();
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as AntigravityAccountsFile;
}
