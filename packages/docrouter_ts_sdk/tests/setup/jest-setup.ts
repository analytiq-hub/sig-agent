import { TestServer, defaultTestConfig } from './test-server';
import { MongoDBTestSetup, TEST_USER_ID, TEST_ORG_ID } from './mongodb-setup';
import { TestFixturesHelper } from './test-fixtures';

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
  const uniqueEnv = `pytest_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  const testDb = await mongoSetup.createTestDatabase(uniqueEnv);
  
  return {
    testDb: testDb.db,
    baseUrl: testServer.getBaseUrl(),
    cleanup: testDb.cleanup
  };
}

// Helper function to create test fixtures (users, orgs, tokens)
export async function createTestFixtures(testDb: any) {
  return await TestFixturesHelper.createOrgAndUsers(testDb);
}

// Export test constants
export { TEST_USER_ID, TEST_ORG_ID };
export { TestFixturesHelper } from './test-fixtures';
