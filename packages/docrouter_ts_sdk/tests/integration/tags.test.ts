import { DocRouterOrg } from '../../src';
import { getTestDatabase, getBaseUrl, createTestFixtures } from '../setup/jest-setup';

describe('Tags Integration Tests', () => {
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

  test('create/get/list/update/delete tag', async () => {
    const created = await client.createTag({
      tag: { name: 'Integration Tag', color: '#123456' }
    });
    expect(created).toBeDefined();
    expect(created.id).toBeDefined();

    const fetched = await client.getTag({ tagId: created.id });
    expect(fetched.name).toBe('Integration Tag');

    const listed = await client.listTags({ limit: 5 });
    expect(Array.isArray(listed.tags)).toBe(true);

    const updated = await client.updateTag({ tagId: created.id, tag: { name: 'Updated Tag' } });
    expect(updated.name).toBe('Updated Tag');

    await client.deleteTag({ tagId: created.id });
    await expect(client.getTag({ tagId: created.id })).rejects.toThrow();
  });
});


