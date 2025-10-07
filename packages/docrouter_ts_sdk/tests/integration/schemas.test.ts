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
      orgToken: testFixtures.admin.token,
      organizationId: testFixtures.org_id
    });
  });

  test('create/list/get/update/delete schema', async () => {
    const created = await client.createSchema({ name: 'Invoice', schema: { fields: [] } as any });
    expect(created).toBeDefined();
    expect(created.id).toBeDefined();

    const listed = await client.listSchemas({ limit: 5 });
    expect(Array.isArray(listed.schemas)).toBe(true);

    const fetched = await client.getSchema({ schemaRevId: created.id });
    expect(fetched.name).toBeDefined();

    const updated = await client.updateSchema({ schemaId: created.id, schema: { name: 'Invoice+' } as any });
    expect(updated.name).toBeDefined();

    await client.deleteSchema({ schemaId: created.id });
    await expect(client.getSchema({ schemaRevId: created.id })).rejects.toThrow();
  });
});


