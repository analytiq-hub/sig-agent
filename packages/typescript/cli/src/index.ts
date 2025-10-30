import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import open from 'open';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

type SetupOptions = {
  server?: string;
  marketplace?: string;
  token?: string;
  nonInteractive?: boolean;
  debug?: boolean;
};

const DEFAULT_SERVER = process.env.SIGAGENT_SERVER_URL || 'https://app.sigagent.ai/fastapi';
const DEFAULT_MARKETPLACE = 'https://github.com/analytiq-hub/sig-agent-marketplace.git';
const DEFAULT_PLUGIN = 'sig-agent@sig-agent-marketplace';

let DEBUG = false;

function ensureDirExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function withTrailingSlash(url: string) {
  return url.endsWith('/') ? url : url + '/';
}

function maskToken(token: string): string {
  if (!token) return '';
  const last4 = token.slice(-4);
  if (token.startsWith('org_')) {
    return `org_***${last4}`;
  }
  return `***${last4}`;
}

function maskedAuthHeader(token: string) {
  return { Authorization: `Bearer ${maskToken(token)}` };
}

function getClaudePaths() {
  const claudeDir = path.join(os.homedir(), '.claude');
  const settingsPath = path.join(claudeDir, 'settings.json');
  return { claudeDir, settingsPath };
}

function buildSigAgentEnv(server: string, token?: string) {
  return {
    CLAUDE_CODE_ENABLE_TELEMETRY: '1',
    OTEL_METRICS_EXPORTER: 'otlp',
    OTEL_LOGS_EXPORTER: 'otlp',
    OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
    OTEL_EXPORTER_OTLP_ENDPOINT: server,
    OTEL_EXPORTER_OTLP_HEADERS: `Authorization=Bearer ${token ?? 'YOUR_ORG_ACCESS_TOKEN'}`
  } as const;
}

function extractTokenFromHeaders(headersValue?: string): string | undefined {
  if (!headersValue) return undefined;
  const cleaned = headersValue.trim().replace(/^"|"$/g, '');
  const parts = cleaned.split(/[,;]+/).map(p => p.trim());
  for (const part of parts) {
    // Authorization=Bearer TOKEN
    let m = /^Authorization\s*=\s*Bearer\s+(.+)$/i.exec(part);
    if (m) return m[1].trim();
    // Authorization: Bearer TOKEN
    m = /^Authorization\s*:\s*Bearer\s+(.+)$/i.exec(part);
    if (m) return m[1].trim();
    // Bearer TOKEN
    m = /^Bearer\s+(.+)$/.exec(part);
    if (m) return m[1].trim();
    // Raw token (fallback) if it looks like org_...
    if (part.startsWith('org_')) return part;
  }
  return undefined;
}

async function promptForToken(promptMessage = 'Enter new organization token (org_...): '): Promise<string | undefined> {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(promptMessage);
    const trimmed = (answer || '').trim();
    return trimmed || undefined;
  } finally {
    rl.close();
  }
}

async function resolveOrganizationId(server: string, token: string): Promise<string | undefined> {
  try {
    const base = server.replace(/\/$/, '');
    const url = `${base}/v0/account/token/organization?token=${encodeURIComponent(token)}`;
    if (DEBUG) console.log(chalk.gray(`[HTTP] GET ${url}`));
    const res = await fetch(url, { method: 'GET' });
    const bodyText = await res.text();
    if (DEBUG) console.log(chalk.gray(`[HTTP] <= ${res.status} ${res.statusText} body: ${bodyText.slice(0, 500)}`));
    if (!res.ok) return undefined;
    const data = JSON.parse(bodyText || '{}');
    return data?.organization_id || undefined;
  } catch {
    return undefined;
  }
}

async function isOrgTokenValid(server: string, token: string): Promise<boolean> {
  // Resolve org id from token first
  const orgId = await resolveOrganizationId(server, token);
  if (!orgId) return false;
  try {
    const base = server.replace(/\/$/, '');
    const url = `${base}/v0/orgs/${encodeURIComponent(orgId)}/telemetry/logs?limit=1`;
    if (DEBUG) console.log(chalk.gray(`[HTTP] GET ${url} headers: ${JSON.stringify(maskedAuthHeader(token))}`));
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    const bodyText = await res.text();
    if (DEBUG) console.log(chalk.gray(`[HTTP] <= ${res.status} ${res.statusText} body: ${bodyText.slice(0, 500)}`));
    return res.ok;
  } catch {
    return false;
  }
}

function updateClaudeSettings(server: string, token?: string) {
  const { claudeDir, settingsPath } = getClaudePaths();
  ensureDirExists(claudeDir);

  let existing: any = {};
  if (fs.existsSync(settingsPath)) {
    try {
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      existing = JSON.parse(raw || '{}');
    } catch {
      existing = {};
    }
  }

  const sigEnv = buildSigAgentEnv(server, token);
  const next = {
    $schema: existing.$schema || 'https://json.schemastore.org/claude-code-settings.json',
    ...existing,
    env: {
      ...(existing.env || {}),
      ...sigEnv
    }
  };

  fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2), 'utf-8');
  return settingsPath;
}

function writeClaudeSettings(server: string, token?: string) {
  const { claudeDir, settingsPath } = getClaudePaths();
  // If file exists, delegate to update to modify only SigAgent keys
  if (fs.existsSync(settingsPath)) {
    return updateClaudeSettings(server, token);
  }

  // Create fresh file when none exists
  ensureDirExists(claudeDir);
  const initial = {
    $schema: 'https://json.schemastore.org/claude-code-settings.json',
    env: buildSigAgentEnv(server, token)
  };
  fs.writeFileSync(settingsPath, JSON.stringify(initial, null, 2), 'utf-8');
  return settingsPath;
}

function updateMarketplaceConfig(marketplaceUrl: string) {
  // Update ~/.claude/settings.json with the marketplace entry under extraKnownMarketplaces
  const { claudeDir, settingsPath } = getClaudePaths();
  ensureDirExists(claudeDir);

  // Helper: parse GitHub URL to owner/repo and choose a marketplace id
  function parseGitHubRepo(inputUrl: string): { ownerRepo: string | null; id: string | null } {
    try {
      // Accept forms like:
      // - https://github.com/owner/repo.git
      // - https://github.com/owner/repo
      // - git@github.com:owner/repo.git
      // - owner/repo
      let ownerRepo: string | null = null;
      let id: string | null = null;

      // SSH form
      const sshMatch = /^git@github\.com:(.+?)\/?$/.exec(inputUrl.trim());
      if (sshMatch) {
        ownerRepo = sshMatch[1].replace(/\.git$/i, '');
      }

      // HTTPS form
      if (!ownerRepo && inputUrl.includes('github.com')) {
        try {
          const u = new URL(inputUrl);
          const parts = u.pathname.replace(/^\//, '').split('/').filter(Boolean);
          if (parts.length >= 2) {
            ownerRepo = `${parts[0]}/${parts[1].replace(/\.git$/i, '')}`;
          }
        } catch {
          // ignore
        }
      }

      // owner/repo form
      if (!ownerRepo && /.+\/.+/.test(inputUrl)) {
        ownerRepo = inputUrl.trim().replace(/\.git$/i, '');
      }

      if (ownerRepo) {
        const repoName = ownerRepo.split('/')[1];
        id = repoName || ownerRepo.replace(/[\/]/g, '-');
      }

      return { ownerRepo, id };
    } catch {
      return { ownerRepo: null, id: null };
    }
  }

  // Read existing settings or initialize baseline
  let settings: any = {};
  if (fs.existsSync(settingsPath)) {
    try {
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      settings = JSON.parse(raw || '{}');
    } catch {
      settings = {};
    }
  }

  const { ownerRepo, id } = parseGitHubRepo(marketplaceUrl);
  if (!ownerRepo || !id) {
    throw new Error(`Unable to parse GitHub repository from marketplace: ${marketplaceUrl}`);
  }

  const next = {
    $schema: settings.$schema || 'https://json.schemastore.org/claude-code-settings.json',
    ...settings,
    extraKnownMarketplaces: {
      ...(settings.extraKnownMarketplaces || {}),
      [id]: { source: { source: 'github', repo: ownerRepo } }
    }
    // Note: we intentionally do not auto-enable specific plugins here.
  };

  fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2), 'utf-8');
  return settingsPath;
}

function enablePlugin(pluginName: string) {
  const { settingsPath } = getClaudePaths();
  let settings: any = {};
  if (fs.existsSync(settingsPath)) {
    try {
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      settings = JSON.parse(raw || '{}');
    } catch {
      settings = {};
    }
  }

  const next = {
    $schema: settings.$schema || 'https://json.schemastore.org/claude-code-settings.json',
    ...settings,
    enabledPlugins: {
      ...(settings.enabledPlugins || {}),
      [pluginName]: true
    }
  };

  fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2), 'utf-8');
  return settingsPath;
}

async function performSetup(opts: SetupOptions) {
  const server = opts.server || DEFAULT_SERVER;
  const marketplace = opts.marketplace || DEFAULT_MARKETPLACE;
  let spinner = ora('Configuring Claude for SigAgent...').start();
  try {
    // If no token provided, try to reuse an existing valid org_ token in settings
    let effectiveToken = opts.token;
    if (!effectiveToken) {
      const { settingsPath } = getClaudePaths();
      if (fs.existsSync(settingsPath)) {
        try {
          const raw = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
          const existingToken = extractTokenFromHeaders(raw?.env?.OTEL_EXPORTER_OTLP_HEADERS);
          ora().succeed(`Parsed OTLP token: ${existingToken ? maskToken(existingToken) : 'none'}`);
          if (existingToken && existingToken.startsWith('org_')) {
            const validSpinner = ora('Validating existing organization token...').start();
            const valid = await isOrgTokenValid(server, existingToken);
            if (valid) {
              const orgId = await resolveOrganizationId(server, existingToken);
              validSpinner.succeed(`Existing token is valid${orgId ? ` for org ${orgId}` : ''}. Reusing it.`);
              effectiveToken = existingToken;
            } else {
              validSpinner.warn('Existing token is invalid. You will need a new token.');
            }
          }
        } catch {
          // ignore parsing errors
        }
      }
    }

    // If we still don't have a valid token, open creation page and interactively prompt the user
    if (!effectiveToken) {
      // pause the main spinner to avoid interfering with prompt output
      if (spinner && spinner.isSpinning) spinner.stop();
      const tokenUrl = new URL('/settings/user/developer/organization-access-tokens', server.replace('/fastapi', ''));
      if (opts.nonInteractive) {
        const msg = `
No organization token provided. Please create one, then re-run with --token <ORG_TOKEN>.
Opening ${chalk.underline(tokenUrl.toString())} in your browser...
`;
        console.log(msg);
        try { await open(tokenUrl.toString()); } catch {}
        return;
      }
      const msg = `
No organization token provided. Please create one if needed.
Opening ${chalk.underline(tokenUrl.toString())} in your browser...
`;
      console.log(msg);
      try { await open(tokenUrl.toString()); } catch {}

      // Prompt up to 3 attempts for a valid token
      for (let attempt = 1; attempt <= 3 && !effectiveToken; attempt++) {
        const entered = await promptForToken(`Enter organization token (attempt ${attempt}/3) or press Enter to cancel: `);
        if (!entered) break;
        const checkSpinner = ora('Validating provided organization token...').start();
        const valid = await isOrgTokenValid(server, entered);
        if (valid) {
          const orgId = await resolveOrganizationId(server, entered);
          checkSpinner.succeed(`Token is valid${orgId ? ` for org ${orgId}` : ''}.`);
          effectiveToken = entered;
          break;
        } else {
          checkSpinner.warn('Provided token is invalid.');
        }
      }

      if (!effectiveToken) {
        console.log(chalk.yellow('No valid token provided. Aborting without updating settings.'));
        // ensure spinner is stopped before exit
        return;
      }

      // resume main spinner now that we can proceed
      spinner = ora('Configuring Claude for SigAgent...').start();
    }

    const settingsPath = writeClaudeSettings(server, effectiveToken);
    spinner.succeed(`Updated ${chalk.cyan(settingsPath)} with telemetry configuration`);

  const spinnerMk = ora('Adding SigAgent marketplace to Claude settings...').start();
  const mpPath = updateMarketplaceConfig(marketplace);
  spinnerMk.succeed(`Updated ${chalk.cyan(mpPath)} with extraKnownMarketplaces entry`);

  const spinnerPlugin = ora('Enabling sig-agent plugin in Claude settings...').start();
  const pluginPath = enablePlugin(DEFAULT_PLUGIN);
  spinnerPlugin.succeed(`Updated ${chalk.cyan(pluginPath)} with enabledPlugins entry for ${DEFAULT_PLUGIN}`);

    console.log(`\n${chalk.green('Setup complete.')} Restart Claude to apply changes.`);
  } catch (err: any) {
    spinner.fail('Setup failed');
    console.error(chalk.red(err?.message || String(err)));
    process.exitCode = 1;
  }
}

async function performUpgrade() {
  // For now, upgrade is equivalent to re-running setup to refresh files
  console.log(chalk.gray('Running upgrade: re-applying configuration.'));
  await performSetup({});
}

const program = new Command();
program
  .name('sigagent')
  .description('SigAgent one-line setup CLI for Claude telemetry and plugins')
  .version('0.1.0');

program
  .command('setup')
  .description('Configure Claude to send telemetry to SigAgent and enable marketplace')
  .option('--server <url>', 'SigAgent FastAPI server URL', DEFAULT_SERVER)
  .option('--marketplace <gitUrl>', 'Claude marketplace repository URL', DEFAULT_MARKETPLACE)
  .option('--token <orgToken>', 'Organization access token (recommended)')
  .option('-d, --debug', 'Enable verbose HTTP trace logs', false)
  .action(async (options: SetupOptions) => {
    DEBUG = Boolean(options.debug);
    await performSetup(options);
  });

program
  .command('upgrade')
  .description('Re-apply configuration and update marketplace entry')
  .action(async () => {
    await performUpgrade();
  });

program.parseAsync(process.argv);



