import { TestServer, defaultTestConfig } from './test-server';
import { MongoDBTestSetup, TEST_USER_ID, TEST_ORG_ID } from './mongodb-setup';
import { TestFixturesHelper } from './test-fixtures';

// Set test environment variables
// NOTE: When ENV starts with 'pytest', the .env file will NOT be loaded (see analytiq_data/common/setup.py)
// All required environment variables must be set here
process.env.ENV = 'pytest_ts'; // Use dedicated database for TypeScript SDK tests
process.env.NEXTAUTH_SECRET = 'test_secret_key_for_tests';
process.env.NEXTAUTH_URL = 'http://127.0.0.1:3000';
process.env.MONGODB_URI = 'mongodb://localhost:27017';
process.env.FASTAPI_ROOT_PATH = '/';
process.env.ADMIN_EMAIL = 'test-admin@example.com';
process.env.ADMIN_PASSWORD = 'test-admin-password-123';
process.env.SES_FROM_EMAIL = 'test@example.com';

// Disable external services for tests
process.env.STRIPE_SECRET_KEY = '';
process.env.STRIPE_WEBHOOK_SECRET = '';
process.env.AWS_ACCESS_KEY_ID = '';
process.env.AWS_SECRET_ACCESS_KEY = '';
process.env.AWS_S3_BUCKET_NAME = '';
process.env.OPENAI_API_KEY = '';
process.env.ANTHROPIC_API_KEY = '';
process.env.GEMINI_API_KEY = '';
process.env.GROQ_API_KEY = '';
process.env.MISTRAL_API_KEY = '';
process.env.XAI_API_KEY = '';

// Lazy-load MongoDB client for workers
let cachedMongoClient: any = null;

async function getMongoClient() {
  if (!cachedMongoClient) {
    const { MongoClient } = await import('mongodb');
    const fs = await import('fs');
    const path = await import('path');

    const configPath = path.join(__dirname, '.test-server-config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    cachedMongoClient = new MongoClient(config.mongodbUri);
    await cachedMongoClient.connect();
  }
  return cachedMongoClient;
}

// Close MongoDB connections when worker exits
afterAll(async () => {
  if (cachedMongoClient) {
    await cachedMongoClient.close();
    cachedMongoClient = null;
  }
});

// Helper function to get test database (no circular refs returned)
// Reads server config from file created by globalSetup
export function getTestDatabase(): any {
  const env = process.env.ENV || 'pytest_ts';
  return {
    collection: (name: string) => {
      // Return a proxy that lazily connects
      return new Proxy({}, {
        get: (target, prop) => {
          return async (...args: any[]) => {
            const client = await getMongoClient();
            const collection = client.db(env).collection(name);
            return (collection as any)[prop](...args);
          };
        }
      });
    }
  };
}

export function getBaseUrl(): string {
  const fs = require('fs');
  const path = require('path');
  const configPath = path.join(__dirname, '.test-server-config.json');

  if (!fs.existsSync(configPath)) {
    throw new Error('Test server config not found. Global setup may have failed.');
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return config.baseUrl;
}

// Helper function to create test fixtures (users, orgs, tokens)
export async function createTestFixtures(testDb: any, baseUrl: string) {
  return await TestFixturesHelper.createOrgAndUsers(testDb, baseUrl);
}

// Export test constants
export { TEST_USER_ID, TEST_ORG_ID };
export { TestFixturesHelper } from './test-fixtures';
