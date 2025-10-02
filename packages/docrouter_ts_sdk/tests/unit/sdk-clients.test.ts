import { DocRouter, DocRouterAccount, DocRouterOrg } from '../../src';

describe('SDK Client Unit Tests', () => {
  describe('DocRouter', () => {
    test('should create instance with token', () => {
      const client = new DocRouter({
        baseURL: 'https://api.example.com',
        token: 'test-token'
      });

      expect(client).toBeDefined();
      expect(client.documents).toBeDefined();
      expect(client.organizations).toBeDefined();
      expect(client.llm).toBeDefined();
      expect(client.tokens).toBeDefined();
      expect(client.users).toBeDefined();
      expect(client.ocr).toBeDefined();
      expect(client.tags).toBeDefined();
    });

    test('should create instance with token provider', () => {
      const tokenProvider = jest.fn().mockResolvedValue('dynamic-token');
      
      const client = new DocRouter({
        baseURL: 'https://api.example.com',
        tokenProvider
      });

      expect(client).toBeDefined();
    });

    test('should update token', () => {
      const client = new DocRouter({
        baseURL: 'https://api.example.com',
        token: 'initial-token'
      });

      client.updateToken('new-token');
      expect(client).toBeDefined();
    });

    test('should update token provider', () => {
      const client = new DocRouter({
        baseURL: 'https://api.example.com',
        token: 'initial-token'
      });

      const newProvider = jest.fn().mockResolvedValue('new-token');
      client.updateTokenProvider(newProvider);
      expect(client).toBeDefined();
    });
  });

  describe('DocRouterAccount', () => {
    test('should create instance with account token', () => {
      const client = new DocRouterAccount({
        baseURL: 'https://api.example.com',
        accountToken: 'account-token'
      });

      expect(client).toBeDefined();
      expect(client.organizations).toBeDefined();
      expect(client.llm).toBeDefined();
      expect(client.tokens).toBeDefined();
      expect(client.users).toBeDefined();
    });

    test('should update account token', () => {
      const client = new DocRouterAccount({
        baseURL: 'https://api.example.com',
        accountToken: 'initial-token'
      });

      client.updateToken('new-token');
      expect(client).toBeDefined();
    });
  });

  describe('DocRouterOrg', () => {
    test('should create instance with org token', () => {
      const client = new DocRouterOrg({
        baseURL: 'https://api.example.com',
        orgToken: 'org-token',
        organizationId: 'org-123'
      });

      expect(client).toBeDefined();
      expect(client.organizationId).toBe('org-123');
      expect(client.documents).toBeDefined();
      expect(client.llm).toBeDefined();
      expect(client.ocr).toBeDefined();
      expect(client.tags).toBeDefined();
    });

    test('should update org token', () => {
      const client = new DocRouterOrg({
        baseURL: 'https://api.example.com',
        orgToken: 'initial-token',
        organizationId: 'org-123'
      });

      client.updateToken('new-token');
      expect(client).toBeDefined();
    });
  });
});
