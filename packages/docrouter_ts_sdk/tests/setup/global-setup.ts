import { TestServer, defaultTestConfig } from './test-server';
import { MongoDBTestSetup } from './mongodb-setup';
import * as fs from 'fs';
import * as path from 'path';

export default async function globalSetup() {
  console.log('Starting shared test server...');

  // Start MongoDB setup
  const mongoSetup = new MongoDBTestSetup();
  await mongoSetup.connect(defaultTestConfig.mongodbUri);

  // Start test server
  const testServer = new TestServer(defaultTestConfig);
  await testServer.start();

  console.log(`Test server ready at ${testServer.getBaseUrl()}`);

  // Store references in global for teardown
  (global as any).__TEST_SERVER__ = testServer;
  (global as any).__MONGO_SETUP__ = mongoSetup;

  // Write server info to a file that workers can read
  const configPath = path.join(__dirname, '.test-server-config.json');
  fs.writeFileSync(configPath, JSON.stringify({
    baseUrl: testServer.getBaseUrl(),
    port: defaultTestConfig.port,
    mongodbUri: defaultTestConfig.mongodbUri
  }));
}
