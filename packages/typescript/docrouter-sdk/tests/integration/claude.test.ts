import { DocRouterOrg, DocRouterAccount } from '../../src';
import { getTestDatabase, getBaseUrl, createTestFixtures } from '../setup/jest-setup';

describe('Claude Integration Tests', () => {
  let testFixtures: { member: { token: string; account_token: string }; org_id: string };
  let client: DocRouterOrg;
  let orgToken: string;

  beforeEach(async () => {
    const testDb = getTestDatabase();
    const baseUrl = getBaseUrl();
    testFixtures = await createTestFixtures(testDb, baseUrl);

    // Create an organization token for the claudeLog endpoint
    const accountClient = new DocRouterAccount({
      baseURL: baseUrl,
      accountToken: testFixtures.member.account_token
    });

    const tokenResponse: any = await accountClient.createOrganizationToken({
      name: `Claude Test Token ${Date.now()}`,
      lifetime: 86400
    }, testFixtures.org_id);

    orgToken = tokenResponse.token;

    client = new DocRouterOrg({
      baseURL: baseUrl,
      orgToken: orgToken,
      organizationId: testFixtures.org_id
    });
  });

  describe('Claude Logs', () => {
    test('should log Claude interaction data', async () => {
      const now = new Date().toISOString();
      const hookData = {
        session_id: 'test-session-123',
        hook_event_name: 'tool_use',
        tool_name: 'web_search',
        permission_mode: 'auto',
        user_id: 'user-123',
        model: 'claude-3-sonnet'
      };

      const logRequest = {
        hook_stdin: JSON.stringify(hookData),
        hook_timestamp: now
      };

      const response = await client.claudeLog(logRequest);

      expect(response).toBeDefined();
      expect(response.log_id).toBeDefined();
      expect(typeof response.log_id).toBe('string');
    });

    test('should log Claude interaction with invalid JSON in hook_stdin', async () => {
      const now = new Date().toISOString();
      const logRequest = {
        hook_stdin: 'invalid json string',
        hook_timestamp: now
      };

      const response = await client.claudeLog(logRequest);

      expect(response).toBeDefined();
      expect(response.log_id).toBeDefined();
      expect(typeof response.log_id).toBe('string');
    });

    test('should list Claude logs', async () => {
      const now = new Date().toISOString();
      const hookData = {
        session_id: 'list-test-session',
        hook_event_name: 'message',
        tool_name: 'file_search',
        permission_mode: 'manual'
      };

      // Create a log entry first
      await client.claudeLog({
        hook_stdin: JSON.stringify(hookData),
        hook_timestamp: now
      });

      // List logs
      const response = await client.listClaudeLogs();

      expect(response).toBeDefined();
      expect(Array.isArray(response.logs)).toBe(true);
      expect(response.total).toBeGreaterThanOrEqual(1);
      expect(response.skip).toBe(0);
      expect(response.limit).toBe(10);

      // Find our created log
      const found = response.logs.find(log => 
        log.hook_stdin && 
        typeof log.hook_stdin === 'object' && 
        'session_id' in log.hook_stdin && 
        log.hook_stdin.session_id === 'list-test-session'
      );
      expect(found).toBeDefined();
      expect(found?.organization_id).toBe(testFixtures.org_id);
    });

    test('should list Claude logs with pagination', async () => {
      const now = new Date().toISOString();

      // Create multiple log entries
      for (let i = 0; i < 3; i++) {
        await client.claudeLog({
          hook_stdin: JSON.stringify({
            session_id: `pagination-test-${i}`,
            hook_event_name: 'test_event',
            index: i
          }),
          hook_timestamp: now
        });
      }

      // Test pagination
      const page1 = await client.listClaudeLogs({ skip: 0, limit: 2 });
      expect(page1.logs.length).toBeLessThanOrEqual(2);
      expect(page1.skip).toBe(0);
      expect(page1.limit).toBe(2);

      const page2 = await client.listClaudeLogs({ skip: 2, limit: 2 });
      expect(page2.skip).toBe(2);
      expect(page2.limit).toBe(2);
    });

    test('should filter Claude logs by session_id', async () => {
      const now = new Date().toISOString();
      const uniqueSessionId = `filter-test-${Date.now()}`;

      // Create a log with specific session_id
      await client.claudeLog({
        hook_stdin: JSON.stringify({
          session_id: uniqueSessionId,
          hook_event_name: 'filter_test',
          tool_name: 'test_tool'
        }),
        hook_timestamp: now
      });

      // Filter by session_id
      const response = await client.listClaudeLogs({
        session_id: uniqueSessionId
      });

      expect(response.logs.length).toBeGreaterThanOrEqual(1);
      const found = response.logs.find(log => 
        log.hook_stdin && 
        typeof log.hook_stdin === 'object' && 
        'session_id' in log.hook_stdin && 
        log.hook_stdin.session_id === uniqueSessionId
      );
      expect(found).toBeDefined();
    });

    test('should filter Claude logs by hook_event_name', async () => {
      const now = new Date().toISOString();
      const uniqueEventName = `event-filter-${Date.now()}`;

      // Create a log with specific hook_event_name
      await client.claudeLog({
        hook_stdin: JSON.stringify({
          session_id: 'event-filter-session',
          hook_event_name: uniqueEventName,
          tool_name: 'event_test_tool'
        }),
        hook_timestamp: now
      });

      // Filter by hook_event_name
      const response = await client.listClaudeLogs({
        hook_event_name: uniqueEventName
      });

      expect(response.logs.length).toBeGreaterThanOrEqual(1);
      const found = response.logs.find(log => 
        log.hook_stdin && 
        typeof log.hook_stdin === 'object' && 
        'hook_event_name' in log.hook_stdin && 
        log.hook_stdin.hook_event_name === uniqueEventName
      );
      expect(found).toBeDefined();
    });

    test('should filter Claude logs by tool_name', async () => {
      const now = new Date().toISOString();
      const uniqueToolName = `tool-filter-${Date.now()}`;

      // Create a log with specific tool_name
      await client.claudeLog({
        hook_stdin: JSON.stringify({
          session_id: 'tool-filter-session',
          hook_event_name: 'tool_use',
          tool_name: uniqueToolName
        }),
        hook_timestamp: now
      });

      // Filter by tool_name
      const response = await client.listClaudeLogs({
        tool_name: uniqueToolName
      });

      expect(response.logs.length).toBeGreaterThanOrEqual(1);
      const found = response.logs.find(log => 
        log.hook_stdin && 
        typeof log.hook_stdin === 'object' && 
        'tool_name' in log.hook_stdin && 
        log.hook_stdin.tool_name === uniqueToolName
      );
      expect(found).toBeDefined();
    });

    test('should filter Claude logs by permission_mode', async () => {
      const now = new Date().toISOString();
      const uniquePermissionMode = `permission-filter-${Date.now()}`;

      // Create a log with specific permission_mode
      await client.claudeLog({
        hook_stdin: JSON.stringify({
          session_id: 'permission-filter-session',
          hook_event_name: 'permission_check',
          tool_name: 'permission_test_tool',
          permission_mode: uniquePermissionMode
        }),
        hook_timestamp: now
      });

      // Filter by permission_mode
      const response = await client.listClaudeLogs({
        permission_mode: uniquePermissionMode
      });

      expect(response.logs.length).toBeGreaterThanOrEqual(1);
      const found = response.logs.find(log => 
        log.hook_stdin && 
        typeof log.hook_stdin === 'object' && 
        'permission_mode' in log.hook_stdin && 
        log.hook_stdin.permission_mode === uniquePermissionMode
      );
      expect(found).toBeDefined();
    });

    test('should filter Claude logs by timestamp range', async () => {
      const now = new Date();
      const startTime = new Date(now.getTime() - 60000).toISOString(); // 1 minute ago
      const endTime = new Date(now.getTime() + 60000).toISOString(); // 1 minute from now

      // Create a log within the time range
      await client.claudeLog({
        hook_stdin: JSON.stringify({
          session_id: 'timestamp-filter-session',
          hook_event_name: 'timestamp_test',
          tool_name: 'timestamp_tool'
        }),
        hook_timestamp: now.toISOString()
      });

      // Filter by timestamp range
      const response = await client.listClaudeLogs({
        start_time: startTime,
        end_time: endTime
      });

      expect(response.logs.length).toBeGreaterThanOrEqual(1);
    });

    test('should combine multiple filters', async () => {
      const now = new Date().toISOString();
      const uniqueSessionId = `combined-filter-${Date.now()}`;
      const uniqueEventName = `combined-event-${Date.now()}`;

      // Create a log with specific values
      await client.claudeLog({
        hook_stdin: JSON.stringify({
          session_id: uniqueSessionId,
          hook_event_name: uniqueEventName,
          tool_name: 'combined_test_tool',
          permission_mode: 'auto'
        }),
        hook_timestamp: now
      });

      // Filter by multiple criteria
      const response = await client.listClaudeLogs({
        session_id: uniqueSessionId,
        hook_event_name: uniqueEventName,
        tool_name: 'combined_test_tool',
        permission_mode: 'auto'
      });

      expect(response.logs.length).toBeGreaterThanOrEqual(1);
      const found = response.logs.find(log => 
        log.hook_stdin && 
        typeof log.hook_stdin === 'object' && 
        'session_id' in log.hook_stdin && 
        log.hook_stdin.session_id === uniqueSessionId &&
        'hook_event_name' in log.hook_stdin && 
        log.hook_stdin.hook_event_name === uniqueEventName
      );
      expect(found).toBeDefined();
    });

    test('should handle empty results', async () => {
      const response = await client.listClaudeLogs({
        session_id: 'non-existent-session-id'
      });

      expect(response).toBeDefined();
      expect(Array.isArray(response.logs)).toBe(true);
      expect(response.logs.length).toBe(0);
      expect(response.total).toBe(0);
    });
  });
});
