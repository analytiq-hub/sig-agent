import { DocRouter, DocRouterAccount, DocRouterOrg } from '../../src';

describe('SDK Functionality Tests', () => {
  describe('Client Instantiation', () => {
    test('DocRouter should create all API modules', () => {
      const client = new DocRouter({
        baseURL: 'https://api.example.com',
        token: 'test-token'
      });

      expect(client.documents).toBeDefined();
      expect(client.organizations).toBeDefined();
      expect(client.llm).toBeDefined();
      expect(client.tokens).toBeDefined();
      expect(client.users).toBeDefined();
      expect(client.ocr).toBeDefined();
      expect(client.tags).toBeDefined();
    });

    test('DocRouterAccount should create account-level API modules', () => {
      const client = new DocRouterAccount({
        baseURL: 'https://api.example.com',
        accountToken: 'account-token'
      });

      expect(client.organizations).toBeDefined();
      expect(client.llm).toBeDefined();
      expect(client.tokens).toBeDefined();
      expect(client.users).toBeDefined();
    });

    test('DocRouterOrg should create organization-scoped API modules', () => {
      const client = new DocRouterOrg({
        baseURL: 'https://api.example.com',
        orgToken: 'org-token',
        organizationId: 'org-123'
      });

      expect(client.organizationId).toBe('org-123');
      // flattened API surface
      expect(typeof client.uploadDocuments).toBe('function');
      expect(typeof client.listDocuments).toBe('function');
      expect(typeof client.getDocument).toBe('function');
      expect(typeof client.updateDocument).toBe('function');
      expect(typeof client.deleteDocument).toBe('function');
      expect(typeof client.getOCRBlocks).toBe('function');
      expect(typeof client.getOCRText).toBe('function');
      expect(typeof client.getOCRMetadata).toBe('function');
      expect(typeof client.runLLM).toBe('function');
      expect(typeof client.getLLMResult).toBe('function');
      expect(typeof client.updateLLMResult).toBe('function');
      expect(typeof client.deleteLLMResult).toBe('function');
      expect(typeof client.downloadAllLLMResults).toBe('function');
      expect(typeof client.createTag).toBe('function');
      expect(typeof client.getTag).toBe('function');
      expect(typeof client.listTags).toBe('function');
      expect(typeof client.updateTag).toBe('function');
      expect(typeof client.deleteTag).toBe('function');
    });
  });

  describe('Token Management', () => {
    test('should update tokens on DocRouter', () => {
      const client = new DocRouter({
        baseURL: 'https://api.example.com',
        token: 'initial-token'
      });

      client.updateToken('new-token');
      expect(client).toBeDefined();
    });

    test('should update tokens on DocRouterAccount', () => {
      const client = new DocRouterAccount({
        baseURL: 'https://api.example.com',
        accountToken: 'initial-token'
      });

      client.updateToken('new-token');
      expect(client).toBeDefined();
    });

    test('should update tokens on DocRouterOrg', () => {
      const client = new DocRouterOrg({
        baseURL: 'https://api.example.com',
        orgToken: 'initial-token',
        organizationId: 'org-123'
      });

      client.updateToken('new-token');
      expect(client).toBeDefined();
    });

    test('should update token provider on DocRouter', () => {
      const client = new DocRouter({
        baseURL: 'https://api.example.com',
        token: 'initial-token'
      });

      const newProvider = jest.fn().mockResolvedValue('provider-token');
      client.updateTokenProvider(newProvider);
      expect(client).toBeDefined();
    });
  });

  describe('API Module Methods', () => {
    test('organizations module should have expected methods', () => {
      const client = new DocRouter({
        baseURL: 'https://api.example.com',
        token: 'test-token'
      });

      expect(typeof client.organizations.list).toBe('function');
      expect(typeof client.organizations.get).toBe('function');
      expect(typeof client.organizations.create).toBe('function');
      expect(typeof client.organizations.update).toBe('function');
      expect(typeof client.organizations.delete).toBe('function');
    });

    test('documents module should have expected methods', () => {
      const client = new DocRouter({
        baseURL: 'https://api.example.com',
        token: 'test-token'
      });

      expect(typeof client.documents.list).toBe('function');
      expect(typeof client.documents.get).toBe('function');
      expect(typeof client.documents.upload).toBe('function');
      expect(typeof client.documents.update).toBe('function');
      expect(typeof client.documents.delete).toBe('function');
    });

    test('llm module should have expected methods', () => {
      const client = new DocRouter({
        baseURL: 'https://api.example.com',
        token: 'test-token'
      });

      expect(typeof client.llm.chat).toBe('function');
      expect(typeof client.llm.chatStream).toBe('function');
      expect(typeof client.llm.updateResult).toBe('function');
    });

    test('tokens module should have expected methods', () => {
      const client = new DocRouterAccount({
        baseURL: 'https://api.example.com',
        accountToken: 'test-token'
      });

      expect(typeof client.tokens.getAccountTokens).toBe('function');
      expect(typeof client.tokens.createOrganizationToken).toBe('function');
      expect(typeof client.tokens.deleteAccountToken).toBe('function');
      expect(typeof client.tokens.deleteOrganizationToken).toBe('function');
    });

    test('users module should have expected methods', () => {
      const client = new DocRouterAccount({
        baseURL: 'https://api.example.com',
        accountToken: 'test-token'
      });

      expect(typeof client.users.list).toBe('function');
      expect(typeof client.users.get).toBe('function');
      expect(typeof client.users.create).toBe('function');
      expect(typeof client.users.update).toBe('function');
      expect(typeof client.users.delete).toBe('function');
    });
  });

  describe('Configuration', () => {
    test('should accept custom timeout', () => {
      const client = new DocRouter({
        baseURL: 'https://api.example.com',
        token: 'test-token',
        timeout: 60000
      });

      expect(client).toBeDefined();
    });

    test('should accept custom retries', () => {
      const client = new DocRouter({
        baseURL: 'https://api.example.com',
        token: 'test-token',
        retries: 5
      });

      expect(client).toBeDefined();
    });

    test('should accept auth error callback', () => {
      const onAuthError = jest.fn();
      const client = new DocRouter({
        baseURL: 'https://api.example.com',
        token: 'test-token',
        onAuthError
      });

      expect(client).toBeDefined();
    });
  });
});
