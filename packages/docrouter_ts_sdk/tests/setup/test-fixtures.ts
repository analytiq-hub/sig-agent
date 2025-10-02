import { ObjectId } from 'mongodb';
import { DocRouter, DocRouterAccount, DocRouterOrg } from '../../src';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import axios from 'axios';

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
  static async createOrgAndUsers(testDb: any, baseURL: string): Promise<{
    org_id: string;
    admin: { id: string; token: string; account_token: string };
    member: { id: string; token: string; account_token: string };
    outsider: { id: string; token: string; account_token: string };
  }> {
    // Use the admin credentials from jest-setup (these must match what uvicorn uses)
    const adminEmail = process.env.ADMIN_EMAIL || 'test-admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'test-admin-password-123';
    
    // Check if admin already exists
    let adminUser = await testDb.collection('users').findOne({ email: adminEmail });
    
    if (!adminUser) {
      // Create admin user with bcrypt hash (like in startup.py)
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      
      const adminResult = await testDb.collection('users').insertOne({
        email: adminEmail,
        password: hashedPassword,
        name: 'System Administrator',
        role: 'admin',
        email_verified: true,
        has_password: true,
        created_at: new Date()
      });
      
      adminUser = {
        _id: adminResult.insertedId,
        email: adminEmail,
        name: 'System Administrator',
        role: 'admin',
        email_verified: true,
        has_password: true,
        created_at: new Date()
      };
      
      // Create organization for admin
      await testDb.collection('organizations').insertOne({
        _id: adminResult.insertedId,
        name: 'Admin',
        type: 'individual',
        members: [{
          user_id: adminResult.insertedId.toString(),
          role: 'admin'
        }],
        created_at: new Date(),
        updated_at: new Date(),
        has_seen_tour: false
      });
    }
    
    const adminId = adminUser._id.toString();

    // Create additional test users
    const memberId = new ObjectId().toString();
    const outsiderId = new ObjectId().toString();

    await testDb.collection('users').insertMany([
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

    // Create JWT tokens using the API (like the frontend does)
    // Note: The admin user must exist in the database before creating JWT tokens
    const adminToken = await this.createJWTTokenFromAPI(adminId, 'System Administrator', adminEmail, baseURL);
    const memberToken = await this.createJWTTokenFromAPI(memberId, 'Org Member', 'member@example.com', baseURL);
    const outsiderToken = await this.createJWTTokenFromAPI(outsiderId, 'Not In Org', 'outsider@example.com', baseURL);
    
    // For account-level operations, use the same JWT tokens
    const adminAccountToken = adminToken;
    const memberAccountToken = memberToken;
    const outsiderAccountToken = outsiderToken;

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

  static generateJWTToken(userId: string, userName: string, email: string): string {
    // Generate a valid JWT token using the same secret as the FastAPI app
    const payload = {
      userId: userId,
      userName: userName,
      email: email
    };
    
    // Use the same secret as the FastAPI app (from test environment)
    const secret = 'test_secret_key_for_tests';
    
    return jwt.sign(payload, secret, { algorithm: 'HS256' });
  }

  static createRequestSignature(jsonString: string): string {
    // The server might load .env file, so we need to use the secret from there
    // In test environment, we override with test_secret_key_for_tests
    const secret = process.env.NEXTAUTH_SECRET || 'test_secret_key_for_tests';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(jsonString);
    return hmac.digest('hex');
  }

  static async createJWTTokenFromAPI(userId: string, userName: string, email: string, baseURL: string): Promise<string> {
    if (!baseURL) {
      throw new Error('baseURL is required for createJWTTokenFromAPI');
    }

    const payload = {
      id: userId,
      name: userName,
      email: email
    };

    const payloadJson = JSON.stringify(payload);
    const signature = this.createRequestSignature(payloadJson);

    try {
      const url = `${baseURL}/v0/account/auth/token`;
      const response = await axios.post(url, payloadJson, {
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Signature': signature
        }
      });

      return response.data.token;
    } catch (error: any) {
      console.error('Error creating JWT token from API:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
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
