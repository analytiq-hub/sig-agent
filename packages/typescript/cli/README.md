SigAgent CLI
============

SigAgent one-line setup for Claude telemetry and plugin marketplace.

Install
-------

```bash
# From repo root
npm --workspace packages/typescript/cli run build
# Or publish/install as a package, then:
# npx -y @sigagent/cli setup --server https://app.sigagent.ai/fastapi
```

Usage
-----

Steps:
- Create an organization token.
- Run:

```bash
npx -y @sigagent/cli setup
```

When prompted, paste your organization token.

What it does:
- Writes `~/.claude/settings.json` with OTLP env variables pointing to the provided server.
- Ensures `~/.claude/marketplaces.json` contains the SigAgent marketplace URL.
- If `--token` not provided, opens the Organization Access Tokens page in the browser.

Notes:
- This CLI does not create tokens automatically because the API requires an authenticated context.
- Restart Claude after running the setup.


Publishing to npm
-----------------

Prerequisites:
- You must have publish access to the `@sigagent` scope.
- Ensure `package.json` has:

```json
{
  "name": "@sigagent/cli",
  "publishConfig": { "access": "public" }
}
```

Steps:

```bash
# From this package directory
cd /home/andrei/build/analytiq/sig-agent/packages/typescript/cli

# Log in (if needed)
npm whoami || npm login

# Install deps and build
npm ci
npm run build

# Inspect the publish contents first
npm publish --dry-run

# Publish (use --access public for scoped public packages)
npm publish --access public
```

Versioning:
- Bump the version before publishing:

```bash
npm version patch   # or minor / major
```

Troubleshooting:
- Scoped packages default to private — include `--access public` or `publishConfig.access=public`.
- If 2FA is enabled on your npm account/org, follow prompts during `npm publish`.
- Ensure `dist/index.js` exists and matches the `bin` field in `package.json`.

