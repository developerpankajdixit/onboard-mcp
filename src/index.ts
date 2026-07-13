#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { checkNodeVersion } from "./checks/node-version.js";
import { checkDocker } from "./checks/docker.js";
import { checkGitConfig } from "./checks/git-config.js";
import { checkEnvFiles } from "./checks/env-files.js";
import { checkPorts } from "./checks/ports.js";
import { formatResults, type CheckResult } from "./checks/types.js";

const server = new McpServer({
  name: "onboard-mcp",
  version: "0.1.0",
});

const projectDirSchema = z
  .string()
  .describe("Absolute path to the project directory to check")
  .optional();

function resolveDir(projectDir?: string): string {
  return projectDir ?? process.cwd();
}

function toText(result: CheckResult | CheckResult[]) {
  const results = Array.isArray(result) ? result : [result];
  return {
    content: [{ type: "text" as const, text: formatResults(results) }],
  };
}

server.tool(
  "check_node_version",
  "Check whether the current Node.js version matches the project's .nvmrc or package.json engines requirement.",
  { projectDir: projectDirSchema },
  async ({ projectDir }) => toText(await checkNodeVersion(resolveDir(projectDir))),
);

server.tool(
  "check_docker",
  "Check whether Docker is installed and the daemon is running.",
  {},
  async () => toText(await checkDocker()),
);

server.tool(
  "check_git_config",
  "Check whether git is installed and user.name / user.email are configured.",
  {},
  async () => toText(await checkGitConfig()),
);

server.tool(
  "check_env_files",
  "Compare .env/.env.local against .env.example and report missing keys (keys only, values are never read into the response).",
  { projectDir: projectDirSchema },
  async ({ projectDir }) => toText(await checkEnvFiles(resolveDir(projectDir))),
);

server.tool(
  "check_ports",
  "Check whether the given TCP ports are free on localhost.",
  {
    ports: z
      .array(z.number().int().min(1).max(65535))
      .describe("Ports the project needs, e.g. [3000, 5432]"),
  },
  async ({ ports }) => toText(await checkPorts(ports)),
);

server.tool(
  "doctor",
  "Run every environment check (Node version, Docker, git config, env files, ports) and return a full report with fixes.",
  {
    projectDir: projectDirSchema,
    ports: z
      .array(z.number().int().min(1).max(65535))
      .describe("Ports the project needs, e.g. [3000, 5432]")
      .optional(),
  },
  async ({ projectDir, ports }) => {
    const dir = resolveDir(projectDir);
    const results = await Promise.all([
      checkNodeVersion(dir),
      checkDocker(),
      checkGitConfig(),
      checkEnvFiles(dir),
      checkPorts(ports ?? []),
    ]);
    return toText(results);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
