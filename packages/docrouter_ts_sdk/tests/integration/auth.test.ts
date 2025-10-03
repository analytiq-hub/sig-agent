import { DocRouter, DocRouterAccount, DocRouterOrg } from '../../src';
import { getTestDatabase, getBaseUrl, createTestFixtures, TestFixturesHelper } from '../setup/jest-setup';

describe('Authentication Integration Tests', () => {
  let tokens: any;

  beforeEach(async () => {
    const testDb = getTestDatabase();
    const baseUrl = getBaseUrl();

    // Create test users and tokens
    tokens = await createTestFixtures(testDb, baseUrl);
  });

  describe('DocRouter (General Purpose)', () => {
    test('should authenticate with account token', async () => {
      const client = new DocRouter({
        baseURL: getBaseUrl(),
        token: tokens.admin.account_token
      });

      // Test account-level endpoint
      const orgs = await client.organizations.list();
      expect(orgs).toBeDefined();
      expect(Array.isArray(orgs.organizations)).toBe(true);
    });

    test('should handle invalid token', async () => {
      const client = new DocRouter({
        baseURL: getBaseUrl(),
        token: 'invalid_token',
        onAuthError: (error) => {
          expect(error.message).toContain('authentication');
        }
      });

      await expect(client.organizations.list()).rejects.toThrow();
    });

    test('should handle token provider', async () => {
      const client = new DocRouter({
        baseURL: getBaseUrl(),
        tokenProvider: async () => tokens.admin.account_token
      });

      const orgs = await client.organizations.list();
      expect(orgs).toBeDefined();
    });
  });

  describe('DocRouterAccount (Account-level)', () => {
    test('should authenticate with account token', async () => {
      const client = new DocRouterAccount({
        baseURL: getBaseUrl(),
        accountToken: tokens.admin.account_token
      });

      const orgs = await client.organizations.list();
      expect(orgs).toBeDefined();
      expect(Array.isArray(orgs.organizations)).toBe(true);
    });

    test('should create organization tokens', async () => {
      const client = new DocRouterAccount({
        baseURL: getBaseUrl(),
        accountToken: tokens.admin.account_token
      });

      const token = await client.tokens.createOrganizationToken({
        name: 'Test Org Token',
        lifetime: 86400
      }, tokens.org_id);

      expect(token).toBeDefined();
      expect(token.name).toBe('Test Org Token');
    });

    test('should list account tokens', async () => {
      const client = new DocRouterAccount({
        baseURL: getBaseUrl(),
        accountToken: tokens.admin.account_token
      });

      const accountTokens = await client.tokens.getAccountTokens();
      expect(accountTokens).toBeDefined();
      expect(Array.isArray(accountTokens)).toBe(true);
    });
  });

  describe('DocRouterOrg (Organization-scoped)', () => {
    test('should authenticate with org token', async () => {
      const client = new DocRouterOrg({
        baseURL: getBaseUrl(),
        orgToken: tokens.admin.token,
        organizationId: tokens.org_id
      });

      // Test organization-scoped endpoint
      const documents = await client.documents.list();
      expect(documents).toBeDefined();
    });

    test('should handle invalid org token', async () => {
      const client = new DocRouterOrg({
        baseURL: getBaseUrl(),
        orgToken: 'invalid_token',
        organizationId: tokens.org_id,
        onAuthError: (error) => {
          expect(error.message).toContain('authentication');
        }
      });

      await expect(client.documents.list()).rejects.toThrow();
    });

    test('should update token', async () => {
      const client = new DocRouterOrg({
        baseURL: getBaseUrl(),
        orgToken: tokens.admin.token,
        organizationId: tokens.org_id
      });

      // Update with member token
      client.updateToken(tokens.member.token);
      
      // Should still work with new token
      const documents = await client.documents.list();
      expect(documents).toBeDefined();
    });
  });

  describe('Permission Tests', () => {
    test('admin should have full access', async () => {
      const client = new DocRouterOrg({
        baseURL: getBaseUrl(),
        orgToken: tokens.admin.token,
        organizationId: tokens.org_id
      });

      // Admin should be able to list documents
      const documents = await client.documents.list();
      expect(documents).toBeDefined();
    });

    test('member should have limited access', async () => {
      const client = new DocRouterOrg({
        baseURL: getBaseUrl(),
        orgToken: tokens.member.token,
        organizationId: tokens.org_id
      });

      // Member should be able to list documents
      const documents = await client.documents.list();
      expect(documents).toBeDefined();
    });

    test('outsider should not have access', async () => {
      const client = new DocRouterOrg({
        baseURL: getBaseUrl(),
        orgToken: tokens.outsider.token,
        organizationId: tokens.org_id,
        onAuthError: (error) => {
          expect(error.message).toContain('access');
        }
      });

      // Outsider should not be able to access org resources
      await expect(client.documents.list()).rejects.toThrow();
    });
  });
});
