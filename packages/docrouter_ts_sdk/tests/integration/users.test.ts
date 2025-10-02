import { DocRouter, DocRouterAccount } from '../../src';
import { createTestDatabase, createTestFixtures } from '../setup/jest-setup';

describe('Users Integration Tests', () => {
  let testDb: any;
  let baseUrl: string;
  let cleanup: () => Promise<void>;
  let tokens: any;

  beforeEach(async () => {
    const setup = await createTestDatabase();
    testDb = setup.testDb;
    baseUrl = setup.baseUrl;
    cleanup = setup.cleanup;

    // Create test users and tokens
    tokens = await createTestFixtures(testDb, baseUrl);
  });

  afterEach(async () => {
    await cleanup();
  });

  describe('User Management', () => {
    test('should list users', async () => {
      const client = new DocRouterAccount({
        baseURL: baseUrl,
        accountToken: tokens.admin.account_token
      });

      const response = await client.users.list();
      
      expect(response).toBeDefined();
      expect(response.users).toBeDefined();
      expect(Array.isArray(response.users)).toBe(true);
      expect(response.total_count).toBeDefined();
      expect(response.skip).toBeDefined();
    });

    test('should list users with organization filter', async () => {
      const client = new DocRouterAccount({
        baseURL: baseUrl,
        accountToken: tokens.admin.account_token
      });

      const response = await client.users.list({
        organization_id: tokens.org_id
      });
      
      expect(response).toBeDefined();
      expect(response.users).toBeDefined();
      expect(Array.isArray(response.users)).toBe(true);
    });

    test('should list users with pagination', async () => {
      const client = new DocRouterAccount({
        baseURL: baseUrl,
        accountToken: tokens.admin.account_token
      });

      const response = await client.users.list({
        skip: 0,
        limit: 5
      });
      
      expect(response).toBeDefined();
      expect(response.users).toBeDefined();
      expect(Array.isArray(response.users)).toBe(true);
      expect(response.skip).toBe(0);
    });

    test('should get specific user', async () => {
      const client = new DocRouterAccount({
        baseURL: baseUrl,
        accountToken: tokens.admin.account_token
      });

      const response = await client.users.get(tokens.admin.id);
      
      expect(response).toBeDefined();
      expect(response.user).toBeDefined();
      expect(response.user.id).toBe(tokens.admin.id);
    });

    test('should create user', async () => {
      const client = new DocRouterAccount({
        baseURL: baseUrl,
        accountToken: tokens.admin.account_token
      });

      const newUser = {
        email: 'newuser@example.com',
        name: 'New User',
        password: 'testpassword123'
      };

      const response = await client.users.create(newUser);
      
      expect(response).toBeDefined();
      expect(response.user).toBeDefined();
      expect(response.user.email).toBe(newUser.email);
      expect(response.user.name).toBe(newUser.name);
    });

    test('should update user', async () => {
      const client = new DocRouterAccount({
        baseURL: baseUrl,
        accountToken: tokens.admin.account_token
      });

      const updateData = {
        name: 'Updated Name'
      };

      const response = await client.users.update(tokens.admin.id, updateData);
      
      expect(response).toBeDefined();
      expect(response.user).toBeDefined();
      expect(response.user.name).toBe(updateData.name);
    });

    test('should delete user', async () => {
      const client = new DocRouterAccount({
        baseURL: baseUrl,
        accountToken: tokens.admin.account_token
      });

      // Create a user first
      const newUser = {
        email: 'todelete@example.com',
        name: 'To Delete',
        password: 'testpassword123'
      };

      const createResponse = await client.users.create(newUser);
      const userId = createResponse.user.id;

      // Delete the user
      await client.users.delete(userId);

      // Verify user is deleted
      await expect(client.users.get(userId)).rejects.toThrow();
    });
  });

  describe('Email Verification', () => {
    test('should send verification email', async () => {
      const client = new DocRouterAccount({
        baseURL: baseUrl,
        accountToken: tokens.admin.account_token
      });

      // This should not throw an error
      await expect(client.users.sendVerificationEmail(tokens.admin.id)).resolves.not.toThrow();
    });

    test('should send registration verification email', async () => {
      const client = new DocRouterAccount({
        baseURL: baseUrl,
        accountToken: tokens.admin.account_token
      });

      // This should not throw an error
      await expect(client.users.sendRegistrationVerificationEmail(tokens.admin.id)).resolves.not.toThrow();
    });

    test('should verify email with token', async () => {
      const client = new DocRouterAccount({
        baseURL: baseUrl,
        accountToken: tokens.admin.account_token
      });

      // This should not throw an error (even with invalid token)
      await expect(client.users.verifyEmail('invalid_token')).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid user ID', async () => {
      const client = new DocRouterAccount({
        baseURL: baseUrl,
        accountToken: tokens.admin.account_token
      });

      await expect(client.users.get('invalid_id')).rejects.toThrow();
    });

    test('should handle unauthorized access', async () => {
      const client = new DocRouterAccount({
        baseURL: baseUrl,
        accountToken: 'invalid_token'
      });

      await expect(client.users.list()).rejects.toThrow();
    });

    test('should handle duplicate email', async () => {
      const client = new DocRouterAccount({
        baseURL: baseUrl,
        accountToken: tokens.admin.account_token
      });

      const newUser = {
        email: 'admin@example.com', // This email already exists
        name: 'Duplicate User',
        password: 'testpassword123'
      };

      await expect(client.users.create(newUser)).rejects.toThrow();
    });
  });
});
