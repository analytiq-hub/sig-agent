import { spawn, ChildProcess, exec } from 'child_process';
import { promisify } from 'util';
import { setTimeout } from 'timers/promises';
import * as path from 'path';
import * as fs from 'fs';

export interface TestServerConfig {
  port: number;
  mongodbUri: string;
  env: string;
  nextauthSecret: string;
}

export class TestServer {
  private process: ChildProcess | null = null;
  private config: TestServerConfig;
  private baseUrl: string;

  constructor(config: TestServerConfig) {
    this.config = config;
    this.baseUrl = `http://localhost:${config.port}`;
  }

  async start(): Promise<void> {
    if (this.process) {
      throw new Error('Test server is already running');
    }

    // Set environment variables
    const env = {
      ...process.env,
      PORT: this.config.port.toString(),
      MONGODB_URI: this.config.mongodbUri,
      ENV: this.config.env,
      NEXTAUTH_SECRET: this.config.nextauthSecret,
      ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'test-admin@example.com',
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'test-password-123',
      STRIPE_SECRET_KEY: '', // Disable Stripe for tests
      STRIPE_WEBHOOK_SECRET: '',
    };

    const packagesDir = path.join(__dirname, '../../..'); // Go up to packages directory
    const sdkDir = path.join(__dirname, '../..'); // docrouter_ts_sdk directory
    const venvPython = path.join(sdkDir, '.venv/bin/python');

    // Check if virtual environment exists, if not create it
    await this.ensureVenv(sdkDir);

    // Start the FastAPI server using the virtual environment
    // The server needs to run from the packages directory where docrouter_app is located
    this.process = spawn(venvPython, [
      '-m', 'uvicorn',
      'docrouter_app.main:app',
      '--host', '0.0.0.0',
      '--port', this.config.port.toString(),
      '--reload'
    ], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: packagesDir // This should be the packages directory
    });

    // Suppress server logs during tests
    this.process.stdout?.on('data', () => {});
    this.process.stderr?.on('data', () => {});

    this.process.on('error', (error) => {
      console.error(`Server process error: ${error.message}`);
    });

    this.process.on('exit', () => {
      // Server exited - suppress log
    });

    // Wait for server to start
    await this.waitForServer();
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        this.process!.on('exit', () => resolve());
        // Force kill after 5 seconds
        setTimeout(5000).then(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
            resolve();
          }
        });
      });
      this.process = null;
    }
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private async ensureVenv(sdkDir: string): Promise<void> {
    const venvDir = path.join(sdkDir, '.venv');
    const venvPython = path.join(venvDir, 'bin/python');
    const packagesDir = path.join(sdkDir, '..');

    // Remove existing virtual environment if it exists
    if (fs.existsSync(venvDir)) {
      console.log('Removing existing virtual environment...');
      fs.rmSync(venvDir, { recursive: true, force: true });
    }

    console.log('Creating virtual environment...');
    // Create virtual environment in docrouter_ts_sdk directory
    await this.execCommand('python3 -m venv .venv', sdkDir);

    // Install requirements from packages directory
    console.log('Installing Python dependencies...');
    await this.execCommand(`uv pip install -r ${path.join(packagesDir, 'requirements.txt')}`, sdkDir);
  }

  private async execCommand(command: string, cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      exec(command, { cwd }, (error, stdout, stderr) => {
        if (error) {
          console.error(`Command failed: ${command}`);
          console.error(`Error: ${error.message}`);
          console.error(`Stderr: ${stderr}`);
          reject(error);
        } else {
          console.log(`Command succeeded: ${command}`);
          if (stdout) console.log(`Stdout: ${stdout}`);
          resolve();
        }
      });
    });
  }

  private async waitForServer(maxRetries = 60): Promise<void> {
    // Give the server a bit more time to initialize before first check
    await setTimeout(2000);

    for (let i = 0; i < maxRetries; i++) {
      try {
        // Try to connect to the server (any endpoint will do)
        const response = await fetch(`${this.baseUrl}/docs`);
        if (response.status === 200 || response.status === 404) {
          // Server is responding, now wait for admin user to be created
          await this.waitForAdminUser();
          return;
        }
      } catch (error) {
        // Server not ready yet - only log every 5 attempts to reduce noise
        if (i % 5 === 0) {
          console.log(`Waiting for server... (${i + 1}/${maxRetries})`);
        }
      }
      await setTimeout(500);
    }
    throw new Error(`Test server failed to start after ${maxRetries * 0.5} seconds`);
  }

  private async waitForAdminUser(maxRetries = 30): Promise<void> {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(this.config.mongodbUri);

    try {
      await client.connect();
      const db = client.db(this.config.env);
      const adminEmail = process.env.ADMIN_EMAIL || 'test-admin@example.com';

      for (let i = 0; i < maxRetries; i++) {
        const adminUser = await db.collection('users').findOne({ email: adminEmail });
        if (adminUser) {
          console.log('Admin user created successfully');
          return;
        }

        if (i % 5 === 0 && i > 0) {
          console.log(`Waiting for admin user... (${i + 1}/${maxRetries})`);
        }
        await setTimeout(500);
      }

      throw new Error(`Admin user not created after ${maxRetries * 0.5} seconds`);
    } finally {
      await client.close();
    }
  }
}

// Default test server configuration
export const defaultTestConfig: TestServerConfig = {
  port: 8001, // Use different port from main app
  mongodbUri: 'mongodb://localhost:27017',
  env: 'pytest_ts', // Use dedicated database for TypeScript SDK tests
  nextauthSecret: 'test_secret_key_for_tests'
};
