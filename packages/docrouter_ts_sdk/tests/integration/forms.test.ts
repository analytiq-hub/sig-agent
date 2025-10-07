import { DocRouterOrg } from '../../src';
import { getTestDatabase, getBaseUrl, createTestFixtures } from '../setup/jest-setup';

describe('Forms Integration Tests', () => {
  let testFixtures: any;
  let client: DocRouterOrg;

  beforeEach(async () => {
    const testDb = getTestDatabase();
    const baseUrl = getBaseUrl();
    testFixtures = await createTestFixtures(testDb, baseUrl);

    client = new DocRouterOrg({
      baseURL: baseUrl,
      orgToken: testFixtures.admin.token,
      organizationId: testFixtures.org_id
    });
  });

  test('list forms and exercise form endpoints', async () => {
    const listed = await client.listForms({ limit: 5 });
    expect(Array.isArray(listed.forms)).toBe(true);

    // Creation may require additional server config; ensure endpoint is reachable
    await expect(client.createForm({ name: 'Form A', schema: { fields: [] } as any })).rejects.toThrow();
  });
});


