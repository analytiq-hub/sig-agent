import { DocRouterOrg } from '../../src';
import { getTestDatabase, getBaseUrl, createTestFixtures } from '../setup/jest-setup';

describe('Prompts Integration Tests', () => {
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

  test('create/list/get/update/delete prompt', async () => {
    const created = await client.createPrompt({ prompt: { name: 'Prompt A', content: 'Extract fields' } as any });
    expect(created).toBeDefined();
    expect(created.id).toBeDefined();

    const listed = await client.listPrompts({ limit: 5 });
    expect(Array.isArray(listed.prompts)).toBe(true);

    const fetched = await client.getPrompt({ promptRevId: created.id });
    expect(fetched.name).toBeDefined();

    const updated = await client.updatePrompt({ promptId: created.id, prompt: { name: 'Prompt A+' } });
    expect(updated.name).toBe('Prompt A+');

    await client.deletePrompt({ promptId: created.id });
    await expect(client.getPrompt({ promptRevId: created.id })).rejects.toThrow();
  });
});


