import { MongoClient, Db } from 'mongodb';
import { ObjectId } from 'mongodb';

export interface TestDatabase {
  db: Db;
  client: MongoClient;
  cleanup: () => Promise<void>;
}

export class MongoDBTestSetup {
  private client: MongoClient | null = null;
  private databases: Db[] = [];

  async connect(mongodbUri: string): Promise<void> {
    this.client = new MongoClient(mongodbUri);
    await this.client.connect();
  }

  async createTestDatabase(env: string): Promise<TestDatabase> {
    if (!this.client) {
      throw new Error('MongoDB client not connected. Call connect() first.');
    }

    const db = this.client.db(env);
    this.databases.push(db);

    // Clear the database
    await this.clearDatabase(db);

    // Initialize payments system
    await this.initPayments(db);

    // Create test user and organization
    await this.createTestData(db);

    return {
      db,
      client: this.client,
      cleanup: async () => {
        await this.clearDatabase(db);
      }
    };
  }

  async cleanup(): Promise<void> {
    // Clean up all test databases
    for (const db of this.databases) {
      await this.clearDatabase(db);
    }
    this.databases = [];

    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  private async clearDatabase(db: Db): Promise<void> {
    const collections = await db.listCollections().toArray();
    for (const collection of collections) {
      await db.collection(collection.name).drop().catch(() => {
        // Collection might not exist, ignore error
      });
    }
  }

  private async initPayments(db: Db): Promise<void> {
    // Initialize payments collections (simplified version)
    await db.collection('payments_customers').createIndex({ organization_id: 1 }, { unique: true });
    await db.collection('payments_subscriptions').createIndex({ organization_id: 1 }, { unique: true });
    await db.collection('payments_usage').createIndex({ organization_id: 1, date: 1 }, { unique: true });
  }

  private async createTestData(db: Db): Promise<void> {
    const testUserId = new ObjectId('6579a94b1f1d8f5a8e9c0124');
    const testOrgId = new ObjectId('6579a94b1f1d8f5a8e9c0123');

    // Create test user
    await db.collection('users').insertOne({
      _id: testUserId,
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin',
      email_verified: true,
      has_password: true,
      created_at: new Date()
    });

    // Create test organization
    await db.collection('organizations').insertOne({
      _id: testOrgId,
      name: 'Test Organization',
      members: [{
        user_id: testUserId.toString(),
        role: 'admin'
      }],
      type: 'team',
      created_at: new Date(),
      updated_at: new Date()
    });

    // Create payment customer for the organization
    await db.collection('payments_customers').insertOne({
      organization_id: testOrgId.toString(),
      stripe_customer_id: 'cus_test123',
      created_at: new Date()
    });
  }
}

// Test data constants (matching Python tests)
export const TEST_USER_ID = '6579a94b1f1d8f5a8e9c0124';
export const TEST_ORG_ID = '6579a94b1f1d8f5a8e9c0123';

export interface TestUser {
  user_id: string;
  user_name: string;
  token_type: string;
}

export const TEST_USER: TestUser = {
  user_id: TEST_USER_ID,
  user_name: 'test@example.com',
  token_type: 'jwt'
};
