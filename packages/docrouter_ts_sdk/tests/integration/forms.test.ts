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

  test('create/list/get/update/delete form', async () => {
    const created = await client.createForm({ name: 'Form A', schema: { fields: [] } });
    expect(created).toBeDefined();
    expect(created.id).toBeDefined();

    const listed = await client.listForms({ limit: 5 });
    expect(Array.isArray(listed.forms)).toBe(true);

    const fetched = await client.getForm({ formRevId: created.id });
    expect(fetched.name).toBeDefined();

    const updated = await client.updateForm({ formId: created.id, form: { name: 'Form A+' } });
    expect(updated.name).toBe('Form A+');

    await client.deleteForm({ formId: created.id });
    await expect(client.getForm({ formRevId: created.id })).rejects.toThrow();
  });
});


