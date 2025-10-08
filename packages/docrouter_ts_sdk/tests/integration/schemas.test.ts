import { DocRouterOrg } from '../../src';
import { getTestDatabase, getBaseUrl, createTestFixtures } from '../setup/jest-setup';

describe('Schemas Integration Tests', () => {
  let testFixtures: any;
  let client: DocRouterOrg;

  beforeEach(async () => {
    const testDb = getTestDatabase();
    const baseUrl = getBaseUrl();
    testFixtures = await createTestFixtures(testDb, baseUrl);

    client = new DocRouterOrg({
      baseURL: baseUrl,
      orgToken: testFixtures.member.token,
      organizationId: testFixtures.org_id
    });
  });

  test('list schemas and exercise schema endpoints', async () => {
    const listed = await client.listSchemas({ limit: 5 });
    expect(Array.isArray(listed.schemas)).toBe(true);

    // Creation may require org setup; verify error path
    await expect(client.createSchema({ name: 'Invoice', schema: { fields: [] } as any })).rejects.toThrow();
  });
});


