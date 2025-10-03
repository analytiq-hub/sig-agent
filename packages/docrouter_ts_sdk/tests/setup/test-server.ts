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
      STRIPE_SECRET_KEY: '', // Disable Stripe for tests
      STRIPE_WEBHOOK_SECRET: '',
    };

    const packagesDir = path.join(__dirname, '../../..'); // Go up to packages directory
    const venvPython = path.join(packagesDir, '.venv/bin/python');

    // Check if virtual environment exists, if not create it
    await this.ensureVenv(packagesDir);

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

    this.process.on('exit', (code, signal) => {
      console.log(`Server process exited with code ${code}, signal ${signal}`);
    });

    // Wait for server to start
    await this.waitForServer();
    
    // Log server startup
    console.log(`Test server started at ${this.baseUrl}`);
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

  private async ensureVenv(packagesDir: string): Promise<void> {
    const venvDir = path.join(packagesDir, '.venv');
    const venvPython = path.join(venvDir, 'bin/python');
    
    console.log(`Checking for virtual environment at: ${venvPython}`);
    console.log(`Packages directory: ${packagesDir}`);
    
    // Check if virtual environment exists
    if (!fs.existsSync(venvPython)) {
      console.log('Creating virtual environment...');
      
      // Create virtual environment
      await this.execCommand('python3 -m venv .venv', packagesDir);
      
      // Install requirements
      console.log('Installing Python dependencies...');
      await this.execCommand('.venv/bin/pip install -r requirements.txt', packagesDir);
    } else {
      console.log('Virtual environment already exists');
    }
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
          // Give it one more second to fully initialize
          await setTimeout(1000);
          return; // Server is responding
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
}

// Default test server configuration
export const defaultTestConfig: TestServerConfig = {
  port: 8001, // Use different port from main app
  mongodbUri: 'mongodb://localhost:27017',
  env: 'pytest_ts', // Use dedicated database for TypeScript SDK tests
  nextauthSecret: 'test_secret_key_for_tests'
};
