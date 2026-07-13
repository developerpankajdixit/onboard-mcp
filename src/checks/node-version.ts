import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CheckResult } from "./types.js";

async function readExpectedVersion(projectDir: string): Promise<string | null> {
  try {
    const nvmrc = await readFile(join(projectDir, ".nvmrc"), "utf8");
    return nvmrc.trim().replace(/^v/, "");
  } catch {
    // fall through to package.json engines
  }

  try {
    const raw = await readFile(join(projectDir, "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { engines?: { node?: string } };
    return pkg.engines?.node ?? null;
  } catch {
    return null;
  }
}

export function satisfiesMajor(current: string, expected: string): boolean {
  const currentMajor = Number.parseInt(current.replace(/^v/, ""), 10);
  const match = expected.match(/(\d+)/);
  if (!match) return false;
  const expectedMajor = Number.parseInt(match[1], 10);

  if (/^[><=^~]*\s*\d/.test(expected) && expected.includes(">=")) {
    return currentMajor >= expectedMajor;
  }
  return currentMajor === expectedMajor || currentMajor >= expectedMajor;
}

export async function checkNodeVersion(
  projectDir: string,
  currentVersion: string = process.version,
): Promise<CheckResult> {
  const expected = await readExpectedVersion(projectDir);

  if (!expected) {
    return {
      check: "node-version",
      status: "skip",
      message: "No .nvmrc or package.json engines.node found, nothing to compare against.",
      fix: "Add a .nvmrc file with your project's Node version so every developer uses the same one.",
    };
  }

  if (satisfiesMajor(currentVersion, expected)) {
    return {
      check: "node-version",
      status: "pass",
      message: `Node ${currentVersion} satisfies the project requirement (${expected}).`,
    };
  }

  return {
    check: "node-version",
    status: "fail",
    message: `Node ${currentVersion} does not satisfy the project requirement (${expected}).`,
    fix: `Run "nvm install ${expected} && nvm use ${expected}" (or install Node ${expected} with your version manager).`,
  };
}
