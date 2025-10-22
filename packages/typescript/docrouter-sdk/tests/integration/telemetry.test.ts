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

    test('upload and list metrics with enhanced fields', async () => {
      const now = Date.now() * 1000000;
      const uniqueId = Date.now().toString();

      const uploaded = await client.uploadMetrics({
        metrics: [{
          name: `enhanced.metric.${uniqueId}`,
          description: 'Enhanced metric with all fields',
          unit: 'ms',
          type: 'histogram',
          data_points: [
            {
              timeUnixNano: String(now),
              value: { asDouble: 100.5 }
            },
            {
              timeUnixNano: String(now + 1000000),
              value: { asDouble: 200.7 }
            }
          ],
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'enhanced-service' } },
              { key: 'service.version', value: { stringValue: '1.2.3' } }
            ]
          },
          tag_ids: [],
          metadata: { 
            enhanced: 'true',
            test_id: uniqueId,
            environment: 'test'
          }
        }]
      });

      // Verify upload response includes all enhanced fields
      expect(uploaded.metrics[0].description).toBe('Enhanced metric with all fields');
      expect(uploaded.metrics[0].unit).toBe('ms');
      expect(uploaded.metrics[0].type).toBe('histogram');
      expect(uploaded.metrics[0].data_point_count).toBe(2);
      expect(uploaded.metrics[0].data_points).toBeDefined();
      expect(uploaded.metrics[0].data_points?.length).toBe(2);
      expect(uploaded.metrics[0].resource).toBeDefined();
      expect(uploaded.metrics[0].uploaded_by).toBeDefined();
      expect(uploaded.metrics[0].upload_date).toBeDefined();

      // Verify data points structure
      expect(uploaded.metrics[0].data_points?.[0]).toHaveProperty('timeUnixNano');
      expect(uploaded.metrics[0].data_points?.[0]).toHaveProperty('value');
      expect(uploaded.metrics[0].data_points?.[0].value).toHaveProperty('asDouble');

      // Verify resource structure
      expect(uploaded.metrics[0].resource).toHaveProperty('attributes');
      expect(Array.isArray(uploaded.metrics[0].resource?.attributes)).toBe(true);

      // List metrics and verify enhanced fields are present
      const listed = await client.listMetrics({ name_search: `enhanced.metric.${uniqueId}` });
      expect(listed.metrics.length).toBeGreaterThanOrEqual(1);
      
      const found = listed.metrics.find(m => m.metric_id === uploaded.metrics[0].metric_id);
      expect(found).toBeDefined();
      expect(found?.description).toBe('Enhanced metric with all fields');
      expect(found?.unit).toBe('ms');
      expect(found?.type).toBe('histogram');
      expect(found?.data_point_count).toBe(2);
      expect(found?.data_points).toBeDefined();
      expect(found?.data_points?.length).toBe(2);
      expect(found?.resource).toBeDefined();
      expect(found?.metadata?.enhanced).toBe('true');
      expect(found?.metadata?.test_id).toBe(uniqueId);
      expect(found?.metadata?.environment).toBe('test');
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

    test('upload and list logs with enhanced fields', async () => {
      const uniqueId = Date.now().toString();
      const timestamp = new Date().toISOString();
      const traceId = `trace${uniqueId.padStart(24, '0')}`;
      const spanId = `span${uniqueId.padStart(12, '0')}`;

      const uploaded = await client.uploadLogs({
        logs: [{
          timestamp,
          severity: 'ERROR',
          body: `Enhanced log message ${uniqueId}`,
          attributes: {
            'log.level': 'ERROR',
            'module': 'enhanced-test',
            'function': 'testFunction',
            'line_number': '42',
            'error_code': 'E001',
            'user_id': 'user123',
            'session_id': 'session456'
          },
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'enhanced-service' } },
              { key: 'service.version', value: { stringValue: '2.0.0' } },
              { key: 'deployment.environment', value: { stringValue: 'test' } },
              { key: 'host.name', value: { stringValue: 'test-host' } }
            ]
          },
          trace_id: traceId,
          span_id: spanId,
          tag_ids: [],
          metadata: { 
            enhanced: 'true',
            test_id: uniqueId,
            category: 'error',
            source: 'sdk-test'
          }
        }]
      });

      // Verify upload response includes all enhanced fields
      expect(uploaded.logs[0].log_id).toBeDefined();
      expect(uploaded.logs[0].body).toBe(`Enhanced log message ${uniqueId}`);
      expect(uploaded.logs[0].severity).toBe('ERROR');
      expect(uploaded.logs[0].timestamp).toBeDefined();
      expect(uploaded.logs[0].attributes).toBeDefined();
      expect(uploaded.logs[0].resource).toBeDefined();
      expect(uploaded.logs[0].trace_id).toBe(traceId);
      expect(uploaded.logs[0].span_id).toBe(spanId);
      expect(uploaded.logs[0].uploaded_by).toBeDefined();
      expect(uploaded.logs[0].upload_date).toBeDefined();

      // Verify attributes structure
      expect(uploaded.logs[0].attributes).toHaveProperty('log.level', 'ERROR');
      expect(uploaded.logs[0].attributes).toHaveProperty('module', 'enhanced-test');
      expect(uploaded.logs[0].attributes).toHaveProperty('function', 'testFunction');
      expect(uploaded.logs[0].attributes).toHaveProperty('line_number', '42');
      expect(uploaded.logs[0].attributes).toHaveProperty('error_code', 'E001');
      expect(uploaded.logs[0].attributes).toHaveProperty('user_id', 'user123');
      expect(uploaded.logs[0].attributes).toHaveProperty('session_id', 'session456');

      // Verify resource structure
      expect(uploaded.logs[0].resource).toHaveProperty('attributes');
      expect(Array.isArray(uploaded.logs[0].resource?.attributes)).toBe(true);
      expect(uploaded.logs[0].resource?.attributes?.length).toBe(4);

      // List logs and verify enhanced fields are present
      const listed = await client.listLogs({ limit: 100 });
      const found = listed.logs.find(l => l.log_id === uploaded.logs[0].log_id);
      
      expect(found).toBeDefined();
      expect(found?.body).toBe(`Enhanced log message ${uniqueId}`);
      expect(found?.severity).toBe('ERROR');
      expect(found?.attributes).toBeDefined();
      expect(found?.resource).toBeDefined();
      expect(found?.trace_id).toBe(traceId);
      expect(found?.span_id).toBe(spanId);
      expect(found?.metadata?.enhanced).toBe('true');
      expect(found?.metadata?.test_id).toBe(uniqueId);
      expect(found?.metadata?.category).toBe('error');
      expect(found?.metadata?.source).toBe('sdk-test');

      // Verify attributes are preserved in list response
      expect(found?.attributes).toHaveProperty('log.level', 'ERROR');
      expect(found?.attributes).toHaveProperty('module', 'enhanced-test');
      expect(found?.attributes).toHaveProperty('function', 'testFunction');
      expect(found?.attributes).toHaveProperty('error_code', 'E001');
      expect(found?.attributes).toHaveProperty('user_id', 'user123');
      expect(found?.attributes).toHaveProperty('session_id', 'session456');

      // Verify resource attributes are preserved
      expect(found?.resource?.attributes?.length).toBe(4);
      const serviceNameAttr = found?.resource?.attributes?.find((attr: any) => attr.key === 'service.name');
      expect(serviceNameAttr?.value?.stringValue).toBe('enhanced-service');
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

    test('upload all telemetry types with enhanced fields and cross-references', async () => {
      const now = Date.now() * 1000000;
      const timestamp = new Date().toISOString();
      const uniqueId = Date.now().toString();
      const traceId = `mixed${uniqueId.padStart(24, '0')}`;
      const spanId = `mixed${uniqueId.padStart(12, '0')}`;

      // Upload trace with enhanced fields
      const traces = await client.uploadTraces({
        traces: [{
          resource_spans: [{
            resource: {
              attributes: [
                { key: 'service.name', value: { stringValue: 'mixed-service' } },
                { key: 'service.version', value: { stringValue: '3.0.0' } }
              ]
            },
            scope_spans: [{
              scope: { name: 'mixed-scope', version: '1.0.0' },
              spans: [{
                traceId,
                spanId,
                name: 'mixed-enhanced-span',
                kind: 1,
                startTimeUnixNano: String(now),
                endTimeUnixNano: String(now + 1000000),
                attributes: [
                  { key: 'operation.name', value: { stringValue: 'mixed-operation' } },
                  { key: 'user.id', value: { stringValue: 'user789' } }
                ]
              }]
            }]
          }],
          metadata: { 
            mixed: 'enhanced-trace',
            test_id: uniqueId,
            category: 'integration'
          }
        }]
      });

      // Upload metric with enhanced fields and trace reference
      const metrics = await client.uploadMetrics({
        metrics: [{
          name: `mixed.enhanced.metric.${uniqueId}`,
          description: 'Mixed telemetry enhanced metric',
          unit: 'ms',
          type: 'histogram',
          data_points: [
            {
              timeUnixNano: String(now),
              value: { asDouble: 150.5 }
            },
            {
              timeUnixNano: String(now + 500000),
              value: { asDouble: 250.3 }
            }
          ],
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'mixed-service' } },
              { key: 'service.version', value: { stringValue: '3.0.0' } }
            ]
          },
          metadata: { 
            mixed: 'enhanced-metric',
            test_id: uniqueId,
            trace_id: traceId,
            category: 'integration'
          }
        }]
      });

      // Upload log with enhanced fields and trace/span references
      const logs = await client.uploadLogs({
        logs: [{
          timestamp,
          severity: 'INFO',
          body: `Mixed enhanced telemetry test ${uniqueId}`,
          attributes: {
            'log.level': 'INFO',
            'module': 'mixed-integration',
            'operation': 'mixed-operation',
            'user_id': 'user789',
            'trace_id': traceId,
            'span_id': spanId
          },
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'mixed-service' } },
              { key: 'service.version', value: { stringValue: '3.0.0' } },
              { key: 'deployment.environment', value: { stringValue: 'integration-test' } }
            ]
          },
          trace_id: traceId,
          span_id: spanId,
          metadata: { 
            mixed: 'enhanced-log',
            test_id: uniqueId,
            category: 'integration'
          }
        }]
      });

      // Verify all were uploaded with enhanced fields
      expect(traces.traces[0].trace_id).toBeDefined();
      expect(metrics.metrics[0].metric_id).toBeDefined();
      expect(logs.logs[0].log_id).toBeDefined();

      // Verify enhanced fields in upload responses
      expect(metrics.metrics[0].description).toBe('Mixed telemetry enhanced metric');
      expect(metrics.metrics[0].unit).toBe('ms');
      expect(metrics.metrics[0].type).toBe('histogram');
      expect(metrics.metrics[0].data_point_count).toBe(2);
      expect(metrics.metrics[0].data_points).toBeDefined();
      expect(metrics.metrics[0].resource).toBeDefined();

      expect(logs.logs[0].attributes).toBeDefined();
      expect(logs.logs[0].resource).toBeDefined();
      expect(logs.logs[0].trace_id).toBe(traceId);
      expect(logs.logs[0].span_id).toBe(spanId);

      // Verify all are listable with enhanced fields preserved
      const listedTraces = await client.listTraces({ limit: 100 });
      const listedMetrics = await client.listMetrics({ limit: 100 });
      const listedLogs = await client.listLogs({ limit: 100 });

      const foundTrace = listedTraces.traces.find(t => t.trace_id === traces.traces[0].trace_id);
      const foundMetric = listedMetrics.metrics.find(m => m.metric_id === metrics.metrics[0].metric_id);
      const foundLog = listedLogs.logs.find(l => l.log_id === logs.logs[0].log_id);

      expect(foundTrace).toBeDefined();
      expect(foundMetric).toBeDefined();
      expect(foundLog).toBeDefined();

      // Verify enhanced fields are preserved in list responses
      expect(foundMetric?.description).toBe('Mixed telemetry enhanced metric');
      expect(foundMetric?.unit).toBe('ms');
      expect(foundMetric?.type).toBe('histogram');
      expect(foundMetric?.data_point_count).toBe(2);
      expect(foundMetric?.data_points).toBeDefined();
      expect(foundMetric?.resource).toBeDefined();
      expect(foundMetric?.metadata?.test_id).toBe(uniqueId);
      expect(foundMetric?.metadata?.trace_id).toBe(traceId);

      expect(foundLog?.attributes).toBeDefined();
      expect(foundLog?.resource).toBeDefined();
      expect(foundLog?.trace_id).toBe(traceId);
      expect(foundLog?.span_id).toBe(spanId);
      expect(foundLog?.attributes).toHaveProperty('trace_id', traceId);
      expect(foundLog?.attributes).toHaveProperty('span_id', spanId);
      expect(foundLog?.metadata?.test_id).toBe(uniqueId);

      // Verify cross-references are consistent
      expect(foundMetric?.metadata?.trace_id).toBe(foundLog?.trace_id);
      expect(foundLog?.attributes).toHaveProperty('trace_id', foundMetric?.metadata?.trace_id);
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
