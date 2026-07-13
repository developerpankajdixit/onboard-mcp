import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { CheckResult } from "./types.js";

const execAsync = promisify(exec);

export type CommandRunner = (command: string) => Promise<{ stdout: string }>;

const defaultRunner: CommandRunner = (command) =>
  execAsync(command, { timeout: 10_000 });

export async function checkDocker(
  run: CommandRunner = defaultRunner,
): Promise<CheckResult> {
  try {
    await run("docker --version");
  } catch {
    return {
      check: "docker",
      status: "fail",
      message: "Docker CLI not found.",
      fix: "Install Docker Desktop (macOS/Windows) or Docker Engine (Linux), then restart your terminal.",
    };
  }

  try {
    await run("docker info");
    return {
      check: "docker",
      status: "pass",
      message: "Docker is installed and the daemon is running.",
    };
  } catch {
    return {
      check: "docker",
      status: "fail",
      message: "Docker is installed but the daemon is not running.",
      fix: "Start Docker Desktop, or on Linux run \"sudo systemctl start docker\".",
    };
  }
}
