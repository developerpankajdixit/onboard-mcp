# Releasing checklist

Do this after any change worth shipping. First release: do it now (CI must be green first).

## 1. Publish to npm

One-time setup (first release only):

```bash
npm login                       # create account at npmjs.com if needed
npm view onboard-mcp            # should say 404 = name is free
```

Every release:

```bash
npm test && npm run build       # never publish red
npm publish                     # runs build automatically via prepublishOnly
npx -y onboard-mcp --help       # sanity check it installs from npm
```

For later releases, bump the version first:

```bash
npm version patch               # bug fixes: 0.1.0 -> 0.1.1
npm version minor               # new tools/features: 0.1.0 -> 0.2.0
git push && git push --tags
```

## 2. Create the GitHub release

GitHub repo -> Releases -> "Create a new release"

- Tag: v0.1.0 (match the package.json version, create the tag if it does not exist)
- Title: v0.1.0 - initial release
- Description: short list of what is in it. For v0.1.0:
  - 6 tools: doctor, check_node_version, check_docker, check_git_config, check_env_files, check_ports
  - Every failing check returns the exact fix command
  - Env check compares key names only, values never leave the machine
  - 23 unit tests, CI on Linux and macOS across Node 18/20/22

## 3. After the first release only

- Repo home page -> gear icon next to About -> check "Releases" so the section shows
- Leave "Packages" and "Deployments" unchecked (Packages is GitHub's own registry, not npm; nothing deploys)

## 4. Announce (first release, then only for big versions)

- PR adding onboard-mcp to the awesome-mcp-servers list
- LinkedIn post: the 2-weeks-to-30-minutes story, link to the repo
- Optional: Show HN post on Hacker News
