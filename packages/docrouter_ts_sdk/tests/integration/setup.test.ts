import { getTestDatabase, getBaseUrl, createTestFixtures } from '../setup/jest-setup';

describe('Test Setup Verification', () => {
  test('should get test database', async () => {
    const testDb = getTestDatabase();
    const baseUrl = getBaseUrl();

    expect(testDb).toBeDefined();
    expect(baseUrl).toBeDefined();
    expect(testDb.collection).toBeDefined();
    expect(typeof testDb.collection).toBe('function');
  });

  test('should create test fixtures', async () => {
    const testDb = getTestDatabase();
    const baseUrl = getBaseUrl();

    try {
      const tokens = await createTestFixtures(testDb, baseUrl);

      expect(tokens).toBeDefined();
      expect(tokens.org_id).toBeDefined();
      expect(tokens.admin).toBeDefined();
      expect(tokens.member).toBeDefined();
      expect(tokens.outsider).toBeDefined();

      expect(tokens.admin.token).toBeDefined();
      expect(tokens.admin.account_token).toBeDefined();
      expect(tokens.member.token).toBeDefined();
      expect(tokens.member.account_token).toBeDefined();
      expect(tokens.outsider.token).toBeDefined();
      expect(tokens.outsider.account_token).toBeDefined();
    } catch (error) {
      throw error;
    }
  });

  test('should verify server is running', async () => {
    const baseUrl = getBaseUrl();

    // Test that we can make a request to the server
    const response = await fetch(`${baseUrl}/docs`);
    expect(response.status).toBe(200);
  });
});
