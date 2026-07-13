# onboard-mcp

**Your dev environment, fixed by asking your AI assistant.**

An MCP (Model Context Protocol) server that checks the things that silently break local development: wrong Node version, Docker not running, missing git config, missing .env keys, busy ports. Ask your AI assistant "is my environment ready?" and get a pass/fail report with the exact fix for everything that's broken.

[![CI](https://github.com/developerpankajdixit/onboard-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/developerpankajdixit/onboard-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## Why

Every developer has lost an afternoon to "it works on my machine": the app fails because Node is one major version off, or the port is taken by a zombie process, or `.env.local` is missing a key that was added last sprint. On my team, environment setup issues cost every new developer days.

This server turns that debugging into one question in your AI chat:

> **You:** run the doctor on my project, it needs ports 3000 and 5432
>
> **Assistant:**
> ```
> [PASS] node-version: Node v20.11.0 satisfies the project requirement (20).
> [FAIL] docker: Docker is installed but the daemon is not running.
>        Fix: Start Docker Desktop, or on Linux run "sudo systemctl start docker".
> [PASS] git-config: Git is installed and user.name / user.email are configured.
> [FAIL] env-files: .env.local is missing 1 key(s) from .env.example: REDIS_URL.
>        Fix: Add the missing keys to .env.local. Ask a teammate or your secrets manager for the values.
> [PASS] ports: All required ports are free: 3000, 5432.
>
> 2 failing, 0 warning(s). Fixes listed above.
> ```

## Tools

| Tool | What it checks |
|------|----------------|
| `doctor` | Runs everything below and returns one report |
| `check_node_version` | Current Node vs `.nvmrc` or `package.json` engines |
| `check_docker` | Docker CLI installed and daemon running |
| `check_git_config` | git installed, `user.name` / `user.email` set |
| `check_env_files` | `.env` / `.env.local` vs `.env.example` (compares keys only, never reads your values into the response) |
| `check_ports` | Whether the TCP ports your project needs are free |

## Requirements

- **Node.js 18 or newer** — required for every client, since the server runs via `npx onboard-mcp`. Check with `node --version`; install from [nodejs.org](https://nodejs.org) if needed.

That's the only universal dependency. `npx` fetches the published package automatically — no clone or build required. The **Claude Code** steps below additionally need the `claude` CLI (`npm install -g @anthropic-ai/claude-code`); other clients do not.

## Quick start

### Claude Code

Requires the [Claude Code CLI](https://code.claude.com/docs). Install it first if you don't have it:

```bash
npm install -g @anthropic-ai/claude-code
```

Then register the server:

```bash
claude mcp add --scope user onboard -- npx -y onboard-mcp
```

(`--scope user` makes it available in every project; omit it to register for the current project only.) Verify with `claude mcp get onboard`.

Or clone and build locally:

```bash
git clone https://github.com/developerpankajdixit/onboard-mcp.git
cd onboard-mcp && npm install && npm run build
claude mcp add onboard -- node /absolute/path/to/onboard-mcp/dist/index.js
```

### VS Code (GitHub Copilot agent mode)

Add to `.vscode/mcp.json` in your project:

```json
{
  "servers": {
    "onboard": {
      "command": "npx",
      "args": ["-y", "onboard-mcp"]
    }
  }
}
```

### Cursor

Settings → MCP → Add new global MCP server, or add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "onboard": {
      "command": "npx",
      "args": ["-y", "onboard-mcp"]
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "onboard": {
      "command": "npx",
      "args": ["-y", "onboard-mcp"]
    }
  }
}
```

Then ask: *"Run the doctor on /path/to/my/project, it needs ports 3000 and 5432."*

Any other MCP-compatible client works the same way: point it at `npx -y onboard-mcp` over stdio.

## Design notes

- **Fixes, not just failures.** Every failing check returns the exact command to fix it, so the assistant can offer to run it.
- **Secrets never leave your machine.** The env check compares key names only. Values are never included in any tool response.
- **Pure check functions.** Every check is a plain async function with injectable dependencies, tested without mocking the MCP layer (23 unit tests, CI on Linux and macOS across Node 18/20/22).

## Development

```bash
npm install
npm test          # vitest
npm run build     # tsc
npm run dev       # run the server from source
```

## Roadmap

- `fix_*` counterpart tools that apply the suggested fixes after confirmation
- Configurable check list via an `onboard.config.json` in the project root
- Database connectivity checks (Postgres, Redis) behind a flag

## License

MIT. Built by [Pankaj Dixit](https://pankajdixit.com), based on an internal MCP onboarding tool that cut new-developer setup from 2 weeks to under 30 minutes.
