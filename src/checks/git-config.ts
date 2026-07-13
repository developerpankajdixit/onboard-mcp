import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { CheckResult } from "./types.js";
import type { CommandRunner } from "./docker.js";

const execAsync = promisify(exec);

const defaultRunner: CommandRunner = (command) =>
  execAsync(command, { timeout: 10_000 });

export async function checkGitConfig(
  run: CommandRunner = defaultRunner,
): Promise<CheckResult> {
  try {
    await run("git --version");
  } catch {
    return {
      check: "git-config",
      status: "fail",
      message: "Git is not installed.",
      fix: "Install git from https://git-scm.com or via your package manager.",
    };
  }

  const missing: string[] = [];

  for (const key of ["user.name", "user.email"]) {
    try {
      const { stdout } = await run(`git config --get ${key}`);
      if (!stdout.trim()) missing.push(key);
    } catch {
      missing.push(key);
    }
  }

  if (missing.length === 0) {
    return {
      check: "git-config",
      status: "pass",
      message: "Git is installed and user.name / user.email are configured.",
    };
  }

  return {
    check: "git-config",
    status: "fail",
    message: `Git is installed but missing config: ${missing.join(", ")}.`,
    fix: missing
      .map((key) =>
        key === "user.name"
          ? 'git config --global user.name "Your Name"'
          : 'git config --global user.email "you@example.com"',
      )
      .join(" && "),
  };
}
