const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function makeTempHome() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sigagent-cli-test-'));
  // Create a fake HOME for the CLI to write into
  return tmp;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

describe('sigagent CLI setup', () => {
  jest.setTimeout(30000);

  it('writes Claude settings with telemetry, marketplace and enabled plugin', () => {
    const fakeHome = makeTempHome();
    const cliPath = path.resolve(__dirname, '..', 'dist', 'index.js');

    const result = spawnSync(process.execPath, [cliPath, 'setup', '--token', 'org_test_token', '--server', 'http://localhost:9/fastapi'], {
      env: {
        ...process.env,
        HOME: fakeHome,
        // Prevent any possible platform-specific behavior
        CI: 'true'
      },
      encoding: 'utf-8'
    });

    if (result.status !== 0) {
      // Help diagnose failures in CI/local
      // eslint-disable-next-line no-console
      console.error('CLI stdout:\n', result.stdout);
      // eslint-disable-next-line no-console
      console.error('CLI stderr:\n', result.stderr);
    }
    // CLI should exit successfully
    expect(result.status).toBe(0);

    const settingsPath = path.join(fakeHome, '.claude', 'settings.json');
    expect(fs.existsSync(settingsPath)).toBe(true);

    const settings = readJson(settingsPath);

    // env keys set
    expect(settings.env).toBeDefined();
    expect(settings.env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('http://localhost:9/fastapi');
    expect(settings.env.CLAUDE_CODE_ENABLE_TELEMETRY).toBe('1');

    // marketplace added
    expect(settings.extraKnownMarketplaces).toBeDefined();
    // default marketplace id is derived from repo name "sig-agent-marketplace"
    expect(settings.extraKnownMarketplaces['sig-agent-marketplace']).toBeDefined();
    expect(settings.extraKnownMarketplaces['sig-agent-marketplace'].source).toBeDefined();

    // plugin enabled
    expect(settings.enabledPlugins).toBeDefined();
    expect(settings.enabledPlugins['sig-agent@sig-agent-marketplace']).toBe(true);
  });
});


