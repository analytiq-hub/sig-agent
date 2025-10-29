SigAgent CLI
============

SigAgent one-line setup for Claude telemetry and plugin marketplace.

Install
-------

```bash
# From repo root
npm --workspace packages/typescript/cli run build
# Or publish/install as a package, then:
# npx -y @sig-agent/cli setup --server https://app.sigagent.ai/fastapi
```

Usage
-----

```bash
# Configure Claude settings and marketplace
npx -y @sig-agent/cli setup \
  --server https://app.sigagent.ai/fastapi \
  --marketplace https://github.com/analytiq-hub/sig-agent-marketplace.git \
  --token ORG_TOKEN

# Upgrade (re-apply latest defaults)
npx -y @sig-agent/cli upgrade
```

What it does:
- Writes `~/.claude/settings.json` with OTLP env variables pointing to the provided server.
- Ensures `~/.claude/marketplaces.json` contains the SigAgent marketplace URL.
- If `--token` not provided, opens the Organization Access Tokens page in the browser.

Notes:
- This CLI does not create tokens automatically because the API requires an authenticated context. Provide `--token` when available.
- Restart Claude after running the setup.


