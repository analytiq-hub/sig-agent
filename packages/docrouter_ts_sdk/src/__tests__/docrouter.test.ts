import { DocRouter, DocRouterAccount, DocRouterOrg } from '../index';

// Mock fetch for testing
global.fetch = jest.fn();

describe('DocRouter SDK', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DocRouter', () => {
    it('should create instance with token', () => {
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

    it('should create instance with token provider', () => {
      const tokenProvider = jest.fn().mockResolvedValue('dynamic-token');
      
      const client = new DocRouter({
        baseURL: 'https://api.example.com',
        tokenProvider
      });

      expect(client).toBeDefined();
    });

    it('should update token', () => {
      const client = new DocRouter({
        baseURL: 'https://api.example.com',
        token: 'initial-token'
      });

      client.updateToken('new-token');
      // Token update is tested through the HTTP client
      expect(client).toBeDefined();
    });
  });

  describe('DocRouterAccount', () => {
    it('should create instance with account token', () => {
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
  });

  describe('DocRouterOrg', () => {
    it('should create instance with org token', () => {
      const client = new DocRouterOrg({
        baseURL: 'https://api.example.com',
        orgToken: 'org-token',
        organizationId: 'org-123'
      });

      expect(client).toBeDefined();
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
});
