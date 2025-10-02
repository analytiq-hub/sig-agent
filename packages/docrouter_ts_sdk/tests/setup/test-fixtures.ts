import { ObjectId } from 'mongodb';
import { DocRouter, DocRouterAccount, DocRouterOrg } from '../../src';

export interface TestFixtures {
  testDb: any; // MongoDB database
  testUser: TestUser;
  testOrg: TestOrganization;
  adminToken: string;
  memberToken: string;
  outsiderToken: string;
  adminAccountToken: string;
  memberAccountToken: string;
  outsiderAccountToken: string;
  baseUrl: string;
}

export interface TestUser {
  id: string;
  email: string;
  name: string;
  role: string;
  email_verified: boolean;
  has_password: boolean;
  created_at: Date;
}

export interface TestOrganization {
  id: string;
  name: string;
  members: Array<{
    user_id: string;
    role: string;
  }>;
  type: string;
  created_at: Date;
  updated_at: Date;
}

export interface TestTokens {
  admin: {
    id: string;
    token: string;
    account_token: string;
  };
  member: {
    id: string;
    token: string;
    account_token: string;
  };
  outsider: {
    id: string;
    token: string;
    account_token: string;
  };
}

// Test data constants (matching Python tests)
export const TEST_USER_ID = '6579a94b1f1d8f5a8e9c0124';
export const TEST_ORG_ID = '6579a94b1f1d8f5a8e9c0123';

export class TestFixturesHelper {
  static async createOrgAndUsers(testDb: any): Promise<{
    org_id: string;
    admin: { id: string; token: string; account_token: string };
    member: { id: string; token: string; account_token: string };
    outsider: { id: string; token: string; account_token: string };
  }> {
    // Create users
    const adminId = new ObjectId().toString();
    const memberId = new ObjectId().toString();
    const outsiderId = new ObjectId().toString();

    await testDb.collection('users').insertMany([
      {
        _id: new ObjectId(adminId),
        email: 'admin@example.com',
        name: 'Org Admin',
        role: 'admin',
        email_verified: true,
        has_password: true,
        created_at: new Date()
      },
      {
        _id: new ObjectId(memberId),
        email: 'member@example.com',
        name: 'Org Member',
        role: 'user',
        email_verified: true,
        has_password: true,
        created_at: new Date()
      },
      {
        _id: new ObjectId(outsiderId),
        email: 'outsider@example.com',
        name: 'Not In Org',
        role: 'user',
        email_verified: true,
        has_password: true,
        created_at: new Date()
      }
    ]);

    // Create org with admin and member
    const orgId = new ObjectId().toString();
    await testDb.collection('organizations').insertOne({
      _id: new ObjectId(orgId),
      name: 'Test Org For Auth',
      members: [
        { user_id: adminId, role: 'admin' },
        { user_id: memberId, role: 'user' }
      ],
      type: 'team',
      created_at: new Date(),
      updated_at: new Date()
    });

    // Create payment customer for the organization
    await testDb.collection('payments_customers').insertOne({
      organization_id: orgId,
      stripe_customer_id: 'cus_test123',
      created_at: new Date()
    });

    // Helper to create a token for a user
    const createToken = async (userId: string, orgId: string | null, name: string): Promise<string> => {
      const token = this.generateToken();
      const tokenDoc = {
        user_id: userId,
        organization_id: orgId,
        name: name,
        token: token, // In real implementation, this would be encrypted
        created_at: new Date(),
        lifetime: 30
      };
      await testDb.collection('access_tokens').insertOne(tokenDoc);
      return token;
    };

    // Create org-level tokens
    const adminToken = await createToken(adminId, orgId, 'admin-token');
    const memberToken = await createToken(memberId, orgId, 'member-token');
    const outsiderToken = await createToken(outsiderId, orgId, 'outsider-token');
    
    // Create account-level tokens
    const adminAccountToken = await createToken(adminId, null, 'admin-account-token');
    const memberAccountToken = await createToken(memberId, null, 'member-account-token');
    const outsiderAccountToken = await createToken(outsiderId, null, 'outsider-account-token');

    return {
      org_id: orgId,
      admin: { id: adminId, token: adminToken, account_token: adminAccountToken },
      member: { id: memberId, token: memberToken, account_token: memberAccountToken },
      outsider: { id: outsiderId, token: outsiderToken, account_token: outsiderAccountToken }
    };
  }

  static generateToken(): string {
    // Generate a random token (in real implementation, this would be properly encrypted)
    return 'test_token_' + Math.random().toString(36).substring(2, 15);
  }

  static createSDKClients(baseUrl: string, tokens: TestTokens) {
    return {
      // General purpose client with JWT token
      docRouter: new DocRouter({
        baseURL: baseUrl,
        token: tokens.admin.account_token
      }),

      // Account-level client
      docRouterAccount: new DocRouterAccount({
        baseURL: baseUrl,
        accountToken: tokens.admin.account_token
      }),

      // Organization-scoped client
      docRouterOrg: new DocRouterOrg({
        baseURL: baseUrl,
        orgToken: tokens.admin.token,
        organizationId: TEST_ORG_ID
      })
    };
  }
}

// Test file generation utilities
export class TestFileGenerator {
  static createSmallPDF(): { name: string; content: ArrayBuffer } {
    const pdfContent = new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
    return {
      name: 'small_test.pdf',
      content: pdfContent.buffer
    };
  }

  static createTestImage(): { name: string; content: ArrayBuffer } {
    // Create a minimal PNG file (1x1 pixel)
    const pngData = new Uint8Array([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixel
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, // IHDR data
      0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
      0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, // IDAT data
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82 // IEND chunk
    ]);
    
    return {
      name: 'test_image.png',
      content: pngData.buffer
    };
  }
}
