import { createTestDatabase, createTestFixtures } from '../setup/jest-setup';

describe('Test Setup Verification', () => {
  test('should create test database', async () => {
    const setup = await createTestDatabase();
    
    expect(setup.testDb).toBeDefined();
    expect(setup.baseUrl).toBeDefined();
    expect(setup.cleanup).toBeDefined();
    expect(typeof setup.cleanup).toBe('function');
    
    await setup.cleanup();
  });

  test('should create test fixtures', async () => {
    const setup = await createTestDatabase();
    
    try {
      const tokens = await createTestFixtures(setup.testDb);
      
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
    } finally {
      await setup.cleanup();
    }
  });

  test('should verify server is running', async () => {
    const setup = await createTestDatabase();
    
    try {
      // Test that we can make a request to the server
      const response = await fetch(`${setup.baseUrl}/docs`);
      expect(response.status).toBe(200);
    } finally {
      await setup.cleanup();
    }
  });
});
