import { SigAgentAccount, SigAgentOrg } from '../../src';

describe('SDK Functionality Tests', () => {
  describe('Client Instantiation', () => {
    test('SigAgentAccount should be constructible', () => {
      const client = new SigAgentAccount({
        baseURL: 'https://api.example.com',
        accountToken: 'test-token'
      });
      expect(client).toBeDefined();
    });

    test('SigAgentAccount should expose account-level APIs', () => {
      const client = new SigAgentAccount({
        baseURL: 'https://api.example.com',
        accountToken: 'account-token'
      });

      expect(typeof client.listOrganizations).toBe('function');
      expect(typeof client.createOrganization).toBe('function');
      expect(typeof client.listLLMModels).toBe('function');
      expect(typeof client.listLLMProviders).toBe('function');
      expect(typeof client.createAccountToken).toBe('function');
      expect(typeof client.listUsers).toBe('function');
    });

    test('SigAgentOrg should create organization-scoped API modules', () => {
      const client = new SigAgentOrg({
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
    // SigAgent removed

    test('should update tokens on SigAgentAccount', () => {
      const client = new SigAgentAccount({
        baseURL: 'https://api.example.com',
        accountToken: 'initial-token'
      });

      client.updateToken('new-token');
      expect(client).toBeDefined();
    });

    test('should update tokens on SigAgentOrg', () => {
      const client = new SigAgentOrg({
        baseURL: 'https://api.example.com',
        orgToken: 'initial-token',
        organizationId: 'org-123'
      });

      client.updateToken('new-token');
      expect(client).toBeDefined();
    });

    // SigAgent removed
  });

  describe('API Module Methods', () => {
    test('SigAgentAccount organizations methods should exist', () => {
      const client = new SigAgentAccount({
        baseURL: 'https://api.example.com',
        accountToken: 'test-token'
      });
      expect(typeof client.listOrganizations).toBe('function');
      expect(typeof client.getOrganization).toBe('function');
      expect(typeof client.createOrganization).toBe('function');
      expect(typeof client.updateOrganization).toBe('function');
      expect(typeof client.deleteOrganization).toBe('function');
    });

    // SigAgent removed

    // SigAgent removed

    test('account token methods should exist', () => {
      const client = new SigAgentAccount({
        baseURL: 'https://api.example.com',
        accountToken: 'test-token'
      });

      expect(typeof client.getAccountTokens).toBe('function');
      expect(typeof client.createOrganizationToken).toBe('function');
      expect(typeof client.deleteAccountToken).toBe('function');
      expect(typeof client.deleteOrganizationToken).toBe('function');
    });

    test('account user methods should exist', () => {
      const client = new SigAgentAccount({
        baseURL: 'https://api.example.com',
        accountToken: 'test-token'
      });

      expect(typeof client.listUsers).toBe('function');
      expect(typeof client.getUser).toBe('function');
      expect(typeof client.createUser).toBe('function');
      expect(typeof client.updateUser).toBe('function');
      expect(typeof client.deleteUser).toBe('function');
    });
  });

  describe('Configuration', () => {
    // SigAgent removed

    // SigAgent removed

    // SigAgent removed
  });
});
