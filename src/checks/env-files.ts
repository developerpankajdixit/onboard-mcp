import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CheckResult } from "./types.js";

export function parseEnvKeys(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => line.slice(0, line.indexOf("=")).trim())
    .filter(Boolean);
}

const EXAMPLE_NAMES = [".env.example", ".env.sample", ".env.template"];
const LOCAL_NAMES = [".env", ".env.local"];

async function readFirstExisting(
  projectDir: string,
  names: string[],
): Promise<{ name: string; content: string } | null> {
  for (const name of names) {
    try {
      const content = await readFile(join(projectDir, name), "utf8");
      return { name, content };
    } catch {
      // try next
    }
  }
  return null;
}

export async function checkEnvFiles(projectDir: string): Promise<CheckResult> {
  const example = await readFirstExisting(projectDir, EXAMPLE_NAMES);

  if (!example) {
    return {
      check: "env-files",
      status: "skip",
      message: "No .env.example (or .env.sample/.env.template) found, nothing to compare against.",
      fix: "Commit a .env.example listing every required variable with placeholder values.",
    };
  }

  const local = await readFirstExisting(projectDir, LOCAL_NAMES);
  const requiredKeys = parseEnvKeys(example.content);

  if (!local) {
    return {
      check: "env-files",
      status: "fail",
      message: `${example.name} exists but no .env or .env.local found. Required keys: ${requiredKeys.join(", ")}.`,
      fix: `Run "cp ${example.name} .env.local" and fill in real values.`,
    };
  }

  const localKeys = new Set(parseEnvKeys(local.content));
  const missing = requiredKeys.filter((key) => !localKeys.has(key));

  if (missing.length === 0) {
    return {
      check: "env-files",
      status: "pass",
      message: `${local.name} has all ${requiredKeys.length} keys required by ${example.name}.`,
    };
  }

  return {
    check: "env-files",
    status: "fail",
    message: `${local.name} is missing ${missing.length} key(s) from ${example.name}: ${missing.join(", ")}.`,
    fix: `Add the missing keys to ${local.name}. Ask a teammate or your secrets manager for the values.`,
  };
}
