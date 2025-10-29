import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import open from 'open';

type SetupOptions = {
  server?: string;
  marketplace?: string;
  token?: string;
  nonInteractive?: boolean;
};

const DEFAULT_SERVER = process.env.SIGAGENT_SERVER_URL || 'https://app.sigagent.ai/fastapi';
const DEFAULT_MARKETPLACE = 'https://github.com/analytiq-hub/sig-agent-marketplace.git';

function ensureDirExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeClaudeSettings(server: string, token?: string) {
  const claudeDir = path.join(os.homedir(), '.claude');
  const settingsPath = path.join(claudeDir, 'settings.json');
  ensureDirExists(claudeDir);

  const content = {
    $schema: 'https://json.schemastore.org/claude-code-settings.json',
    env: {
      CLAUDE_CODE_ENABLE_TELEMETRY: '1',
      OTEL_METRICS_EXPORTER: 'otlp',
      OTEL_LOGS_EXPORTER: 'otlp',
      OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
      OTEL_EXPORTER_OTLP_ENDPOINT: server,
      OTEL_EXPORTER_OTLP_HEADERS: `Authorization=Bearer ${token ?? 'YOUR_ORG_ACCESS_TOKEN'}`
    }
  } as const;

  // Backup any existing file
  if (fs.existsSync(settingsPath)) {
    const backupPath = `${settingsPath}.bak`;
    fs.copyFileSync(settingsPath, backupPath);
  }
  fs.writeFileSync(settingsPath, JSON.stringify(content, null, 2), 'utf-8');
  return settingsPath;
}

function updateMarketplaceConfig(marketplaceUrl: string) {
  const claudeDir = path.join(os.homedir(), '.claude');
  ensureDirExists(claudeDir);
  const marketplacesPath = path.join(claudeDir, 'marketplaces.json');

  let data: { marketplaces: string[] } = { marketplaces: [] };
  if (fs.existsSync(marketplacesPath)) {
    try {
      data = JSON.parse(fs.readFileSync(marketplacesPath, 'utf-8'));
    } catch {
      // If corrupted, overwrite with fresh structure
      data = { marketplaces: [] };
    }
  }

  if (!data.marketplaces.includes(marketplaceUrl)) {
    data.marketplaces.push(marketplaceUrl);
    fs.writeFileSync(marketplacesPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  return marketplacesPath;
}

async function performSetup(opts: SetupOptions) {
  const server = opts.server || DEFAULT_SERVER;
  const marketplace = opts.marketplace || DEFAULT_MARKETPLACE;
  const spinner = ora('Configuring Claude for SigAgent...').start();
  try {
    const settingsPath = writeClaudeSettings(server, opts.token);
    spinner.succeed(`Updated ${chalk.cyan(settingsPath)} with telemetry configuration`);

    const spinnerMk = ora('Adding SigAgent marketplace...').start();
    const mpPath = updateMarketplaceConfig(marketplace);
    spinnerMk.succeed(`Ensured marketplace at ${chalk.cyan(mpPath)}`);

    if (!opts.token) {
      const tokenUrl = new URL('/settings/user/developer/organization-access-tokens', server.replace('/fastapi', ''));
      const msg = `
No organization token provided. Please create one, then re-run with --token <ORG_TOKEN>.
Opening ${chalk.underline(tokenUrl.toString())} in your browser...
`;
      console.log(msg);
      try {
        await open(tokenUrl.toString());
      } catch {
        // Ignore if browser cannot be opened (e.g., headless)
      }
    }

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
  .action(async (options: SetupOptions) => {
    await performSetup(options);
  });

program
  .command('upgrade')
  .description('Re-apply configuration and update marketplace entry')
  .action(async () => {
    await performUpgrade();
  });

program.parseAsync(process.argv);


