import { DocRouter, DocRouterAccount, DocRouterOrg } from '../../src';
import axios from 'axios';

// Mock axios for testing
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Mock Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default axios mock
    mockedAxios.create.mockReturnValue(mockedAxios);
    mockedAxios.get.mockResolvedValue({ data: {} });
    mockedAxios.post.mockResolvedValue({ data: {} });
    mockedAxios.put.mockResolvedValue({ data: {} });
    mockedAxios.delete.mockResolvedValue({ data: {} });
  });

  describe('DocRouter with Mock API', () => {
    test('should handle successful API responses', async () => {
      const mockResponse = {
        organizations: [
          { id: 'org1', name: 'Test Org', type: 'team' }
        ],
        total_count: 1,
        skip: 0
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: mockResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      const client = new DocRouter({
        baseURL: 'https://api.example.com',
        token: 'test-token'
      });

      const result = await client.organizations.list();
      
      expect(result).toEqual(mockResponse);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        '/v0/account/organizations',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      );
    });

    test('should handle API errors', async () => {
      const error = {
        response: {
          status: 401,
          data: { detail: 'Unauthorized' }
        },
        message: 'Request failed with status code 401'
      };
      
      mockedAxios.get.mockRejectedValueOnce(error);

      const client = new DocRouter({
        baseURL: 'https://api.example.com',
        token: 'invalid-token'
      });

      await expect(client.organizations.list()).rejects.toThrow();
    });
  });

  describe('DocRouterAccount with Mock API', () => {
    test('should create organization tokens', async () => {
      const mockResponse = {
        id: 'token123',
        name: 'Test Token',
        token: 'generated_token',
        created_at: '2024-01-01T00:00:00Z',
        lifetime: 86400
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: mockResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      const client = new DocRouterAccount({
        baseURL: 'https://api.example.com',
        accountToken: 'account-token'
      });

      const result = await client.tokens.createOrganizationToken({
        name: 'Test Token',
        lifetime: 86400
      }, 'org123');
      
      expect(result).toEqual(mockResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/v0/orgs/org123/access_tokens',
        {
          name: 'Test Token',
          lifetime: 86400
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer account-token'
          })
        })
      );
    });
  });

  describe('DocRouterOrg with Mock API', () => {
    test('should list documents', async () => {
      const mockResponse = {
        documents: [
          { id: 'doc1', name: 'test.pdf', type: 'application/pdf' }
        ],
        total_count: 1,
        skip: 0
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: mockResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      const client = new DocRouterOrg({
        baseURL: 'https://api.example.com',
        orgToken: 'org-token',
        organizationId: 'org123'
      });

      const result = await client.documents.list();
      
      expect(result).toEqual(mockResponse);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        '/v0/orgs/org123/documents',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer org-token'
          })
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      const client = new DocRouter({
        baseURL: 'https://api.example.com',
        token: 'test-token'
      });

      await expect(client.organizations.list()).rejects.toThrow('Network error');
    });

    test('should handle 402 payment required', async () => {
      const error = {
        response: {
          status: 402,
          data: { detail: 'Payment required' }
        },
        message: 'Request failed with status code 402'
      };
      
      mockedAxios.get.mockRejectedValueOnce(error);

      const client = new DocRouter({
        baseURL: 'https://api.example.com',
        token: 'test-token'
      });

      await expect(client.organizations.list()).rejects.toThrow();
    });
  });

  describe('Token Management', () => {
    test('should update tokens dynamically', async () => {
      const client = new DocRouter({
        baseURL: 'https://api.example.com',
        token: 'initial-token'
      });

      // Update token
      client.updateToken('new-token');

      mockedAxios.get.mockResolvedValueOnce({
        data: { organizations: [] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      await client.organizations.list();
      
      expect(mockedAxios.get).toHaveBeenCalledWith(
        '/v0/account/organizations',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer new-token'
          })
        })
      );
    });

    test('should use token provider', async () => {
      const tokenProvider = jest.fn().mockResolvedValue('provider-token');

      const client = new DocRouter({
        baseURL: 'https://api.example.com',
        tokenProvider
      });

      mockedAxios.get.mockResolvedValueOnce({
        data: { organizations: [] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      await client.organizations.list();
      
      expect(tokenProvider).toHaveBeenCalled();
      expect(mockedAxios.get).toHaveBeenCalledWith(
        '/v0/account/organizations',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer provider-token'
          })
        })
      );
    });
  });
});
