import { createServer } from "node:net";
import type { CheckResult } from "./types.js";

export function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

export async function checkPorts(ports: number[]): Promise<CheckResult> {
  if (ports.length === 0) {
    return {
      check: "ports",
      status: "skip",
      message: "No ports specified.",
    };
  }

  const results = await Promise.all(
    ports.map(async (port) => ({ port, free: await isPortFree(port) })),
  );
  const busy = results.filter((r) => !r.free).map((r) => r.port);

  if (busy.length === 0) {
    return {
      check: "ports",
      status: "pass",
      message: `All required ports are free: ${ports.join(", ")}.`,
    };
  }

  return {
    check: "ports",
    status: "fail",
    message: `Port(s) already in use: ${busy.join(", ")}.`,
    fix: `Find what is using them with "lsof -i :${busy[0]}" (macOS/Linux) or "netstat -ano | findstr :${busy[0]}" (Windows), then stop that process or change your app's port.`,
  };
}
