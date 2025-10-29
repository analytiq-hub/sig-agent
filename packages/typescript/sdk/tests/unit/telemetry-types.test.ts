import { TelemetryMetricResponse, TelemetryLogResponse } from '../../src/types';

describe('Telemetry Types', () => {
  describe('TelemetryMetricResponse', () => {
    test('should have all required fields', () => {
      const metric: TelemetryMetricResponse = {
        metric_id: 'test-metric-id',
        name: 'test.metric',
        type: 'counter',
        data_point_count: 1,
        upload_date: '2023-01-01T00:00:00Z',
        uploaded_by: 'test-user',
        tag_ids: [],
      };

      expect(metric.metric_id).toBe('test-metric-id');
      expect(metric.name).toBe('test.metric');
      expect(metric.type).toBe('counter');
      expect(metric.data_point_count).toBe(1);
      expect(metric.upload_date).toBe('2023-01-01T00:00:00Z');
      expect(metric.uploaded_by).toBe('test-user');
      expect(metric.tag_ids).toEqual([]);
    });

    test('should support enhanced fields', () => {
      const metric: TelemetryMetricResponse = {
        metric_id: 'test-metric-id',
        name: 'test.metric',
        description: 'A test metric',
        unit: 'count',
        type: 'histogram',
        data_points: [
          {
            timeUnixNano: '1640995200000000000',
            value: { asDouble: 42.5 }
          }
        ],
        data_point_count: 1,
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'test-service' } }
          ]
        },
        upload_date: '2023-01-01T00:00:00Z',
        uploaded_by: 'test-user',
        tag_ids: ['tag1', 'tag2'],
        metadata: { source: 'test' }
      };

      expect(metric.description).toBe('A test metric');
      expect(metric.unit).toBe('count');
      expect(metric.type).toBe('histogram');
      expect(metric.data_points).toBeDefined();
      expect(metric.data_points?.length).toBe(1);
      expect(metric.data_points?.[0]).toHaveProperty('timeUnixNano');
      expect(metric.data_points?.[0]).toHaveProperty('value');
      expect(metric.resource).toBeDefined();
      expect(metric.resource?.attributes).toBeDefined();
      expect(Array.isArray(metric.resource?.attributes)).toBe(true);
      expect(metric.tag_ids).toEqual(['tag1', 'tag2']);
      expect(metric.metadata).toEqual({ source: 'test' });
    });
  });

  describe('TelemetryLogResponse', () => {
    test('should have all required fields', () => {
      const log: TelemetryLogResponse = {
        log_id: 'test-log-id',
        timestamp: '2023-01-01T00:00:00Z',
        body: 'Test log message',
        upload_date: '2023-01-01T00:00:00Z',
        uploaded_by: 'test-user',
        tag_ids: [],
      };

      expect(log.log_id).toBe('test-log-id');
      expect(log.timestamp).toBe('2023-01-01T00:00:00Z');
      expect(log.body).toBe('Test log message');
      expect(log.upload_date).toBe('2023-01-01T00:00:00Z');
      expect(log.uploaded_by).toBe('test-user');
      expect(log.tag_ids).toEqual([]);
    });

    test('should support enhanced fields', () => {
      const log: TelemetryLogResponse = {
        log_id: 'test-log-id',
        timestamp: '2023-01-01T00:00:00Z',
        severity: 'ERROR',
        body: 'Test error message',
        attributes: {
          'log.level': 'ERROR',
          'module': 'test-module',
          'function': 'testFunction',
          'line_number': '42',
          'error_code': 'E001'
        },
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'test-service' } },
            { key: 'service.version', value: { stringValue: '1.0.0' } }
          ]
        },
        trace_id: '0123456789abcdef0123456789abcdef',
        span_id: '0123456789abcdef',
        upload_date: '2023-01-01T00:00:00Z',
        uploaded_by: 'test-user',
        tag_ids: ['tag1'],
        metadata: { source: 'test', category: 'error' }
      };

      expect(log.severity).toBe('ERROR');
      expect(log.attributes).toBeDefined();
      expect(log.attributes?.['log.level']).toBe('ERROR');
      expect(log.attributes?.['module']).toBe('test-module');
      expect(log.attributes?.['function']).toBe('testFunction');
      expect(log.attributes?.['line_number']).toBe('42');
      expect(log.attributes?.['error_code']).toBe('E001');
      
      expect(log.resource).toBeDefined();
      expect(log.resource?.attributes).toBeDefined();
      expect(Array.isArray(log.resource?.attributes)).toBe(true);
      expect(log.resource?.attributes?.length).toBe(2);
      
      expect(log.trace_id).toBe('0123456789abcdef0123456789abcdef');
      expect(log.span_id).toBe('0123456789abcdef');
      
      expect(log.tag_ids).toEqual(['tag1']);
      expect(log.metadata).toEqual({ source: 'test', category: 'error' });
    });

    test('should support optional fields', () => {
      const log: TelemetryLogResponse = {
        log_id: 'test-log-id',
        timestamp: '2023-01-01T00:00:00Z',
        body: 'Test log message',
        upload_date: '2023-01-01T00:00:00Z',
        uploaded_by: 'test-user',
        tag_ids: [],
        // Optional fields can be undefined
        severity: undefined,
        attributes: undefined,
        resource: undefined,
        trace_id: undefined,
        span_id: undefined,
        metadata: undefined
      };

      expect(log.severity).toBeUndefined();
      expect(log.attributes).toBeUndefined();
      expect(log.resource).toBeUndefined();
      expect(log.trace_id).toBeUndefined();
      expect(log.span_id).toBeUndefined();
      expect(log.metadata).toBeUndefined();
    });
  });

  describe('Type Safety', () => {
    test('should enforce correct data point structure', () => {
      const metric: TelemetryMetricResponse = {
        metric_id: 'test-metric-id',
        name: 'test.metric',
        type: 'counter',
        data_point_count: 1,
        upload_date: '2023-01-01T00:00:00Z',
        uploaded_by: 'test-user',
        tag_ids: [],
        data_points: [
          {
            timeUnixNano: '1640995200000000000',
            value: { asDouble: 42.5 }
          },
          {
            timeUnixNano: '1640995201000000000',
            value: { asInt: 100 }
          }
        ]
      };

      expect(metric.data_points?.length).toBe(2);
      expect(metric.data_points?.[0].value).toHaveProperty('asDouble');
      expect(metric.data_points?.[1].value).toHaveProperty('asInt');
    });

    test('should enforce correct resource attribute structure', () => {
      const log: TelemetryLogResponse = {
        log_id: 'test-log-id',
        timestamp: '2023-01-01T00:00:00Z',
        body: 'Test log message',
        upload_date: '2023-01-01T00:00:00Z',
        uploaded_by: 'test-user',
        tag_ids: [],
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'test-service' } },
            { key: 'service.version', value: { stringValue: '1.0.0' } },
            { key: 'deployment.environment', value: { stringValue: 'test' } }
          ]
        }
      };

      expect(log.resource?.attributes?.length).toBe(3);
      const serviceNameAttr = log.resource?.attributes?.find(attr => attr.key === 'service.name');
      expect(serviceNameAttr?.value?.stringValue).toBe('test-service');
    });
  });
});
