import { DocRouterAccount } from '../../src';
import { getTestDatabase, getBaseUrl, createTestFixtures } from '../setup/jest-setup';

describe('Users Integration Tests', () => {
  let tokens: any;

  beforeEach(async () => {
    const testDb = getTestDatabase();
    const baseUrl = getBaseUrl();

    // Create test users and tokens
    tokens = await createTestFixtures(testDb, baseUrl);
  });

  describe('User Management', () => {
    test('should list users', async () => {
      const client = new DocRouterAccount({
        baseURL: getBaseUrl(),
        accountToken: tokens.admin.account_token
      });

      const response = await client.listUsers();
      
      expect(response).toBeDefined();
      expect(response.users).toBeDefined();
      expect(Array.isArray(response.users)).toBe(true);
      expect(response.total_count).toBeDefined();
      expect(response.skip).toBeDefined();
    });

    test('should list users with organization filter', async () => {
      const client = new DocRouterAccount({
        baseURL: getBaseUrl(),
        accountToken: tokens.admin.account_token
      });

      const response = await client.listUsers({
        organization_id: tokens.org_id
      });
      
      expect(response).toBeDefined();
      expect(response.users).toBeDefined();
      expect(Array.isArray(response.users)).toBe(true);
    });

    test('should list users with pagination', async () => {
      const client = new DocRouterAccount({
        baseURL: getBaseUrl(),
        accountToken: tokens.admin.account_token
      });

      const response = await client.listUsers({
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
        baseURL: getBaseUrl(),
        accountToken: tokens.admin.account_token
      });

      const response = await client.getUser(tokens.admin.id);
      
      expect(response).toBeDefined();
      expect(response.user).toBeDefined();
      expect(response.user.id).toBe(tokens.admin.id);
    });

    test('should create user', async () => {
      const client = new DocRouterAccount({
        baseURL: getBaseUrl(),
        accountToken: tokens.admin.account_token
      });

      const uniqueEmail = `newuser-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@example.com`;
      const newUser = {
        email: uniqueEmail,
        name: 'New User',
        password: 'testpassword123'
      };

      const response = await client.createUser(newUser);

      expect(response).toBeDefined();
      expect(response.user).toBeDefined();
      expect(response.user.email).toBe(newUser.email);
      expect(response.user.name).toBe(newUser.name);
    });

    test('should update user', async () => {
      const client = new DocRouterAccount({
        baseURL: getBaseUrl(),
        accountToken: tokens.admin.account_token
      });

      const updateData = {
        name: 'Updated Name'
      };

      const response = await client.updateUser(tokens.admin.id, updateData);
      
      expect(response).toBeDefined();
      expect(response.user).toBeDefined();
      expect(response.user.name).toBe(updateData.name);
    });

    test('should delete user', async () => {
      const client = new DocRouterAccount({
        baseURL: getBaseUrl(),
        accountToken: tokens.admin.account_token
      });

      // Create a user first
      const newUser = {
        email: 'todelete@example.com',
        name: 'To Delete',
        password: 'testpassword123'
      };

      const createResponse = await client.createUser(newUser);
      const userId = createResponse.user.id;

      // Delete the user
      await client.deleteUser(userId);

      // Verify user is deleted
      await expect(client.getUser(userId)).rejects.toThrow();
    });
  });

  describe('Email Verification', () => {
    test('should send verification email', async () => {
      const client = new DocRouterAccount({
        baseURL: getBaseUrl(),
        accountToken: tokens.admin.account_token
      });

      // Admin user is already verified, so this will throw
      await expect(client.sendVerificationEmail(tokens.admin.id)).rejects.toThrow();
    });

    test('should send registration verification email', async () => {
      const client = new DocRouterAccount({
        baseURL: getBaseUrl(),
        accountToken: tokens.admin.account_token
      });

      // Admin user is already verified, so this will throw
      await expect(client.sendRegistrationVerificationEmail(tokens.admin.id)).rejects.toThrow();
    });

    test('should verify email with token', async () => {
      const client = new DocRouterAccount({
        baseURL: getBaseUrl(),
        accountToken: tokens.admin.account_token
      });

      // Invalid token should throw an error
      await expect(client.verifyEmail('invalid_token')).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid user ID', async () => {
      const client = new DocRouterAccount({
        baseURL: getBaseUrl(),
        accountToken: tokens.admin.account_token
      });

      await expect(client.getUser('invalid_id')).rejects.toThrow();
    });

    test('should handle unauthorized access', async () => {
      const client = new DocRouterAccount({
        baseURL: getBaseUrl(),
        accountToken: 'invalid_token'
      });

      await expect(client.listUsers()).rejects.toThrow();
    });

    test('should handle duplicate email', async () => {
      const client = new DocRouterAccount({
        baseURL: getBaseUrl(),
        accountToken: tokens.admin.account_token
      });

      // First create a user
      const firstUser = {
        email: `unique-${Date.now()}@example.com`,
        name: 'First User',
        password: 'testpassword123'
      };
      await client.createUser(firstUser);

      // Try to create another user with the same email
      const duplicateUser = {
        email: firstUser.email, // This email already exists
        name: 'Duplicate User',
        password: 'testpassword123'
      };

      await expect(client.createUser(duplicateUser)).rejects.toThrow();
    });
  });
});
