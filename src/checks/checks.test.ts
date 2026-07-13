import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { satisfiesMajor, checkNodeVersion } from "./node-version.js";
import { checkDocker } from "./docker.js";
import { checkGitConfig } from "./git-config.js";
import { parseEnvKeys, checkEnvFiles } from "./env-files.js";
import { isPortFree, checkPorts } from "./ports.js";
import { formatResults } from "./types.js";

async function makeProject(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "onboard-mcp-test-"));
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(dir, name), content);
  }
  return dir;
}

describe("satisfiesMajor", () => {
  it("passes when majors match", () => {
    expect(satisfiesMajor("v20.11.0", "20")).toBe(true);
  });

  it("passes for >= ranges when current is newer", () => {
    expect(satisfiesMajor("v22.1.0", ">=18")).toBe(true);
  });

  it("fails when current is older than required", () => {
    expect(satisfiesMajor("v16.20.0", "20")).toBe(false);
  });
});

describe("checkNodeVersion", () => {
  it("skips when no version requirement exists", async () => {
    const dir = await makeProject({});
    const result = await checkNodeVersion(dir, "v20.0.0");
    expect(result.status).toBe("skip");
  });

  it("reads .nvmrc and passes on a match", async () => {
    const dir = await makeProject({ ".nvmrc": "v20\n" });
    const result = await checkNodeVersion(dir, "v20.11.0");
    expect(result.status).toBe("pass");
  });

  it("reads package.json engines and fails with a fix on mismatch", async () => {
    const dir = await makeProject({
      "package.json": JSON.stringify({ engines: { node: "22" } }),
    });
    const result = await checkNodeVersion(dir, "v18.0.0");
    expect(result.status).toBe("fail");
    expect(result.fix).toContain("22");
  });

  it("prefers .nvmrc over package.json", async () => {
    const dir = await makeProject({
      ".nvmrc": "20",
      "package.json": JSON.stringify({ engines: { node: "22" } }),
    });
    const result = await checkNodeVersion(dir, "v20.0.0");
    expect(result.status).toBe("pass");
  });
});

describe("checkDocker", () => {
  it("fails with an install fix when the CLI is missing", async () => {
    const result = await checkDocker(async () => {
      throw new Error("command not found");
    });
    expect(result.status).toBe("fail");
    expect(result.fix).toContain("Install Docker");
  });

  it("fails with a start fix when the daemon is down", async () => {
    const result = await checkDocker(async (command) => {
      if (command === "docker --version") return { stdout: "Docker 27" };
      throw new Error("daemon not running");
    });
    expect(result.status).toBe("fail");
    expect(result.fix).toContain("Start Docker");
  });

  it("passes when CLI and daemon both respond", async () => {
    const result = await checkDocker(async () => ({ stdout: "ok" }));
    expect(result.status).toBe("pass");
  });
});

describe("checkGitConfig", () => {
  it("fails when git is missing", async () => {
    const result = await checkGitConfig(async () => {
      throw new Error("not found");
    });
    expect(result.status).toBe("fail");
  });

  it("reports which keys are missing", async () => {
    const result = await checkGitConfig(async (command) => {
      if (command === "git --version") return { stdout: "git 2.44" };
      if (command.includes("user.name")) return { stdout: "Pankaj\n" };
      throw new Error("missing");
    });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("user.email");
    expect(result.message).not.toContain("user.name,");
  });

  it("passes when both keys are set", async () => {
    const result = await checkGitConfig(async (command) => {
      if (command === "git --version") return { stdout: "git 2.44" };
      return { stdout: "value\n" };
    });
    expect(result.status).toBe("pass");
  });
});

describe("parseEnvKeys", () => {
  it("extracts keys and ignores comments and blank lines", () => {
    const keys = parseEnvKeys(
      "# comment\nAPI_KEY=abc\n\nDB_URL=postgres://x\nNOT_A_PAIR\n",
    );
    expect(keys).toEqual(["API_KEY", "DB_URL"]);
  });
});

describe("checkEnvFiles", () => {
  it("skips when there is no example file", async () => {
    const dir = await makeProject({});
    const result = await checkEnvFiles(dir);
    expect(result.status).toBe("skip");
  });

  it("fails when the local env file is missing entirely", async () => {
    const dir = await makeProject({ ".env.example": "API_KEY=\nDB_URL=\n" });
    const result = await checkEnvFiles(dir);
    expect(result.status).toBe("fail");
    expect(result.fix).toContain("cp .env.example");
  });

  it("fails and names the missing keys", async () => {
    const dir = await makeProject({
      ".env.example": "API_KEY=\nDB_URL=\nREDIS_URL=\n",
      ".env.local": "API_KEY=real\n",
    });
    const result = await checkEnvFiles(dir);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("DB_URL");
    expect(result.message).toContain("REDIS_URL");
  });

  it("passes when every required key exists locally", async () => {
    const dir = await makeProject({
      ".env.example": "API_KEY=\n",
      ".env": "API_KEY=real\n",
    });
    const result = await checkEnvFiles(dir);
    expect(result.status).toBe("pass");
  });

  it("never includes local env values in the result", async () => {
    const dir = await makeProject({
      ".env.example": "API_KEY=\nDB_URL=\n",
      ".env": "API_KEY=super-secret-value\n",
    });
    const result = await checkEnvFiles(dir);
    expect(JSON.stringify(result)).not.toContain("super-secret-value");
  });
});

describe("ports", () => {
  it("detects a busy port", async () => {
    const server = createServer();
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    expect(await isPortFree(port)).toBe(false);
    const result = await checkPorts([port]);
    expect(result.status).toBe("fail");
    expect(result.message).toContain(String(port));

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("skips when no ports are given", async () => {
    const result = await checkPorts([]);
    expect(result.status).toBe("skip");
  });
});

describe("formatResults", () => {
  it("summarizes failures and includes fixes", () => {
    const text = formatResults([
      { check: "a", status: "pass", message: "fine" },
      { check: "b", status: "fail", message: "broken", fix: "do this" },
    ]);
    expect(text).toContain("[FAIL] b: broken");
    expect(text).toContain("Fix: do this");
    expect(text).toContain("1 failing");
  });

  it("reports a clean environment", () => {
    const text = formatResults([
      { check: "a", status: "pass", message: "fine" },
    ]);
    expect(text).toContain("All checks passed");
  });
});
