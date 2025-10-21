import { DocRouterOrg } from '../../src';
import { getTestDatabase, getBaseUrl, createTestFixtures } from '../setup/jest-setup';

describe('Telemetry Integration Tests', () => {
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

  describe('Traces', () => {
    test('upload and list traces', async () => {
      const now = Date.now() * 1000000; // Convert to nanoseconds

      const uploaded = await client.uploadTraces({
        traces: [{
          resource_spans: [{
            resource: {
              attributes: [
                { key: 'service.name', value: { stringValue: 'test-service' } }
              ]
            },
            scope_spans: [{
              scope: { name: 'test-scope', version: '1.0.0' },
              spans: [{
                traceId: 'a1b2c3d4e5f6071829384756a9b8c7d6',
                spanId: '1234567890abcdef',
                name: 'test-span',
                kind: 1,
                startTimeUnixNano: String(now),
                endTimeUnixNano: String(now + 1000000)
              }]
            }]
          }],
          tag_ids: [],
          metadata: { test: 'true' }
        }]
      });

      expect(uploaded.traces).toBeDefined();
      expect(uploaded.traces.length).toBe(1);
      expect(uploaded.traces[0].trace_id).toBeDefined();
      expect(uploaded.traces[0].span_count).toBe(1);

      // List traces
      const listed = await client.listTraces({ limit: 10 });
      expect(Array.isArray(listed.traces)).toBe(true);
      expect(listed.total).toBeGreaterThanOrEqual(1);

      // Find our uploaded trace
      const found = listed.traces.find(t => t.trace_id === uploaded.traces[0].trace_id);
      expect(found).toBeDefined();
      expect(found?.span_count).toBe(1);
      expect(found?.metadata?.test).toBe('true');
    });

    test('list traces with pagination', async () => {
      const now = Date.now() * 1000000;

      // Upload 3 traces
      await client.uploadTraces({
        traces: Array.from({ length: 3 }, (_, i) => ({
          resource_spans: [{
            scope_spans: [{
              spans: [{
                traceId: `trace${i.toString().padStart(28, '0')}`,
                spanId: `span${i.toString().padStart(12, '0')}`,
                name: `trace-${i}`,
                kind: 1,
                startTimeUnixNano: String(now + i * 1000000),
                endTimeUnixNano: String(now + (i + 1) * 1000000)
              }]
            }]
          }],
          metadata: { index: String(i) }
        }))
      });

      // Test pagination
      const page1 = await client.listTraces({ skip: 0, limit: 2 });
      expect(page1.traces.length).toBeLessThanOrEqual(2);
      expect(page1.skip).toBe(0);
      expect(page1.limit).toBe(2);

      const page2 = await client.listTraces({ skip: 2, limit: 2 });
      expect(page2.skip).toBe(2);
    });

    test('upload traces with tags', async () => {
      // Create a tag first
      const tag = await client.createTag({
        tag: { name: 'trace-tag', description: 'Tag for traces' }
      });

      const now = Date.now() * 1000000;
      const uploaded = await client.uploadTraces({
        traces: [{
          resource_spans: [{
            scope_spans: [{
              spans: [{
                traceId: 'tagged12345678901234567890123456',
                spanId: 'tagged1234567890',
                name: 'tagged-span',
                kind: 1,
                startTimeUnixNano: String(now),
                endTimeUnixNano: String(now + 1000000)
              }]
            }]
          }],
          tag_ids: [tag.id],
          metadata: { tagged: 'yes' }
        }]
      });

      expect(uploaded.traces[0].tag_ids).toContain(tag.id);

      // List with tag filter
      const filtered = await client.listTraces({ tag_ids: tag.id });
      expect(filtered.traces.some(t => t.trace_id === uploaded.traces[0].trace_id)).toBe(true);

      // Cleanup
      await client.deleteTag({ tagId: tag.id });
    });
  });

  describe('Metrics', () => {
    test('upload and list metrics', async () => {
      const now = Date.now() * 1000000;

      const uploaded = await client.uploadMetrics({
        metrics: [{
          name: 'test.metric.counter',
          description: 'A test counter',
          unit: 'count',
          type: 'counter',
          data_points: [{
            timeUnixNano: String(now),
            value: { asDouble: 42.5 }
          }],
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'test-service' } }
            ]
          },
          tag_ids: [],
          metadata: { test: 'metric' }
        }]
      });

      expect(uploaded.metrics).toBeDefined();
      expect(uploaded.metrics.length).toBe(1);
      expect(uploaded.metrics[0].metric_id).toBeDefined();
      expect(uploaded.metrics[0].name).toBe('test.metric.counter');
      expect(uploaded.metrics[0].data_point_count).toBe(1);

      // List metrics
      const listed = await client.listMetrics({ limit: 10 });
      expect(Array.isArray(listed.metrics)).toBe(true);
      expect(listed.total).toBeGreaterThanOrEqual(1);

      // Find our uploaded metric
      const found = listed.metrics.find(m => m.metric_id === uploaded.metrics[0].metric_id);
      expect(found).toBeDefined();
      expect(found?.name).toBe('test.metric.counter');
    });

    test('list metrics with name search', async () => {
      const now = Date.now() * 1000000;
      const uniqueId = Date.now().toString();

      // Upload metric with unique name
      await client.uploadMetrics({
        metrics: [{
          name: `unique.metric.${uniqueId}`,
          type: 'gauge',
          data_points: [{
            timeUnixNano: String(now),
            value: { asDouble: 100 }
          }],
          metadata: { unique: uniqueId }
        }]
      });

      // Search for the metric
      const searched = await client.listMetrics({ name_search: `unique.metric.${uniqueId}` });
      expect(searched.metrics.length).toBeGreaterThanOrEqual(1);
      expect(searched.metrics.some(m => m.name === `unique.metric.${uniqueId}`)).toBe(true);
    });

    test('upload multiple metrics in batch', async () => {
      const now = Date.now() * 1000000;

      const uploaded = await client.uploadMetrics({
        metrics: Array.from({ length: 5 }, (_, i) => ({
          name: `batch.metric.${i}`,
          type: 'gauge',
          data_points: [{
            timeUnixNano: String(now + i * 1000000),
            value: { asDouble: i * 10 }
          }],
          metadata: { batch: 'test', index: String(i) }
        }))
      });

      expect(uploaded.metrics.length).toBe(5);
      uploaded.metrics.forEach((m, i) => {
        expect(m.name).toBe(`batch.metric.${i}`);
        expect(m.data_point_count).toBe(1);
      });
    });
  });

  describe('Logs', () => {
    test('upload and list logs', async () => {
      const uploaded = await client.uploadLogs({
        logs: [{
          timestamp: new Date().toISOString(),
          severity: 'INFO',
          body: 'Test log message',
          attributes: {
            'log.level': 'INFO',
            'module': 'test'
          },
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'test-service' } }
            ]
          },
          trace_id: 'a1b2c3d4e5f6071829384756a9b8c7d6',
          span_id: '1234567890abcdef',
          tag_ids: [],
          metadata: { test: 'log' }
        }]
      });

      expect(uploaded.logs).toBeDefined();
      expect(uploaded.logs.length).toBe(1);
      expect(uploaded.logs[0].log_id).toBeDefined();
      expect(uploaded.logs[0].body).toBe('Test log message');
      expect(uploaded.logs[0].severity).toBe('INFO');

      // List logs
      const listed = await client.listLogs({ limit: 10 });
      expect(Array.isArray(listed.logs)).toBe(true);
      expect(listed.total).toBeGreaterThanOrEqual(1);

      // Find our uploaded log
      const found = listed.logs.find(l => l.log_id === uploaded.logs[0].log_id);
      expect(found).toBeDefined();
      expect(found?.body).toBe('Test log message');
    });

    test('list logs with severity filter', async () => {
      // Upload logs with different severities
      await client.uploadLogs({
        logs: [
          {
            timestamp: new Date().toISOString(),
            severity: 'ERROR',
            body: 'Error log message',
            metadata: { level: 'error' }
          },
          {
            timestamp: new Date().toISOString(),
            severity: 'WARN',
            body: 'Warning log message',
            metadata: { level: 'warn' }
          }
        ]
      });

      // Filter by ERROR severity
      const errors = await client.listLogs({ severity: 'ERROR' });
      expect(errors.logs.length).toBeGreaterThanOrEqual(1);
      errors.logs.forEach(log => {
        if (log.severity) {
          expect(log.severity).toBe('ERROR');
        }
      });
    });

    test('upload logs with trace context', async () => {
      const traceId = 'trace12345678901234567890123456';
      const spanId = 'span1234567890ab';

      const uploaded = await client.uploadLogs({
        logs: [{
          timestamp: new Date().toISOString(),
          severity: 'DEBUG',
          body: 'Log with trace context',
          trace_id: traceId,
          span_id: spanId,
          metadata: { has_trace: 'true' }
        }]
      });

      expect(uploaded.logs[0].log_id).toBeDefined();

      // The trace_id and span_id should be stored with the log
      const listed = await client.listLogs({ limit: 100 });
      const found = listed.logs.find(l => l.log_id === uploaded.logs[0].log_id);
      expect(found).toBeDefined();
    });
  });

  describe('Mixed Telemetry Operations', () => {
    test('upload all three telemetry types together', async () => {
      const now = Date.now() * 1000000;
      const timestamp = new Date().toISOString();

      // Upload trace
      const traces = await client.uploadTraces({
        traces: [{
          resource_spans: [{
            scope_spans: [{
              spans: [{
                traceId: 'mixed12345678901234567890123456',
                spanId: 'mixed1234567890',
                name: 'mixed-span',
                kind: 1,
                startTimeUnixNano: String(now),
                endTimeUnixNano: String(now + 1000000)
              }]
            }]
          }],
          metadata: { mixed: 'trace' }
        }]
      });

      // Upload metric
      const metrics = await client.uploadMetrics({
        metrics: [{
          name: 'mixed.test.metric',
          type: 'counter',
          data_points: [{
            timeUnixNano: String(now),
            value: { asDouble: 123 }
          }],
          metadata: { mixed: 'metric' }
        }]
      });

      // Upload log
      const logs = await client.uploadLogs({
        logs: [{
          timestamp,
          severity: 'INFO',
          body: 'Mixed telemetry test',
          metadata: { mixed: 'log' }
        }]
      });

      // Verify all were uploaded
      expect(traces.traces[0].trace_id).toBeDefined();
      expect(metrics.metrics[0].metric_id).toBeDefined();
      expect(logs.logs[0].log_id).toBeDefined();

      // Verify all are listable
      const listedTraces = await client.listTraces({ limit: 100 });
      const listedMetrics = await client.listMetrics({ limit: 100 });
      const listedLogs = await client.listLogs({ limit: 100 });

      expect(listedTraces.traces.some(t => t.trace_id === traces.traces[0].trace_id)).toBe(true);
      expect(listedMetrics.metrics.some(m => m.metric_id === metrics.metrics[0].metric_id)).toBe(true);
      expect(listedLogs.logs.some(l => l.log_id === logs.logs[0].log_id)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('upload with invalid tag returns error', async () => {
      const now = Date.now() * 1000000;

      await expect(client.uploadTraces({
        traces: [{
          resource_spans: [{
            scope_spans: [{
              spans: [{
                traceId: 'invalid12345678901234567890123456',
                spanId: 'invalid123456789',
                name: 'invalid-span',
                kind: 1,
                startTimeUnixNano: String(now),
                endTimeUnixNano: String(now + 1000000)
              }]
            }]
          }],
          tag_ids: ['000000000000000000000000'], // Non-existent tag ID
          metadata: {}
        }]
      })).rejects.toThrow();
    });
  });
});
