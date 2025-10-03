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
// Disable Stripe for tests
process.env.STRIPE_SECRET_KEY = '';
process.env.STRIPE_WEBHOOK_SECRET = '';

// Global test setup
let testServer: TestServer;
let mongoSetup: MongoDBTestSetup;

beforeAll(async () => {
  // Start MongoDB setup
  mongoSetup = new MongoDBTestSetup();
  await mongoSetup.connect(defaultTestConfig.mongodbUri);

  // Start test server
  testServer = new TestServer(defaultTestConfig);
  await testServer.start();
}, 60000); // 60 second timeout for server startup

afterAll(async () => {
  // Stop test server
  if (testServer) {
    await testServer.stop();
  }

  // Cleanup MongoDB
  if (mongoSetup) {
    await mongoSetup.cleanup();
  }
}, 30000); // 30 second timeout for cleanup

// Helper function to get test database (no circular refs returned)
export function getTestDatabase(): any {
  if (!mongoSetup) {
    throw new Error('MongoDB not initialized. Run beforeAll first.');
  }
  // Return a simple wrapper object instead of the actual Db
  const env = process.env.ENV || 'pytest_ts';
  return {
    collection: (name: string) => mongoSetup['client']?.db(env).collection(name)
  };
}

export function getBaseUrl(): string {
  if (!testServer) {
    throw new Error('Test server not initialized. Run beforeAll first.');
  }
  return testServer.getBaseUrl();
}

// Helper function to create test fixtures (users, orgs, tokens)
export async function createTestFixtures(testDb: any, baseUrl: string) {
  return await TestFixturesHelper.createOrgAndUsers(testDb, baseUrl);
}

// Export test constants
export { TEST_USER_ID, TEST_ORG_ID };
export { TestFixturesHelper } from './test-fixtures';
