import { TestServer, defaultTestConfig } from './test-server';
import { MongoDBTestSetup, TEST_USER_ID, TEST_ORG_ID } from './mongodb-setup';
import { TestFixturesHelper } from './test-fixtures';

// Set test environment variables
process.env.NEXTAUTH_SECRET = 'test_secret_key_for_tests';
process.env.ENV = 'pytest_ts'; // Use dedicated database for TypeScript SDK tests
process.env.ADMIN_EMAIL = 'test-admin@example.com';
process.env.ADMIN_PASSWORD = 'test-admin-password-123';

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

// Helper function to create test database for each test
export async function createTestDatabase(): Promise<{
  testDb: any;
  baseUrl: string;
  cleanup: () => Promise<void>;
}> {
  // Use the same database name that uvicorn uses (pytest_ts)
  // This means tests cannot run in parallel, but they can share the same server instance
  const env = process.env.ENV || 'pytest_ts';
  const testDb = await mongoSetup.createTestDatabase(env);

  return {
    testDb: testDb.db,
    baseUrl: testServer.getBaseUrl(),
    cleanup: testDb.cleanup
  };
}

// Helper function to create test fixtures (users, orgs, tokens)
export async function createTestFixtures(testDb: any, baseUrl: string) {
  return await TestFixturesHelper.createOrgAndUsers(testDb, baseUrl);
}

// Export test constants
export { TEST_USER_ID, TEST_ORG_ID };
export { TestFixturesHelper } from './test-fixtures';
