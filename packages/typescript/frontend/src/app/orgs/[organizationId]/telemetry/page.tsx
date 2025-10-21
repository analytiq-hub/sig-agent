'use client'

import TelemetryTracesList from '@/components/TelemetryTracesList';
import TelemetryMetricsList from '@/components/TelemetryMetricsList';
import TelemetryLogsList from '@/components/TelemetryLogsList';
import { useSearchParams, useRouter } from 'next/navigation';

export default function TelemetryPage({ params }: { params: { organizationId: string } }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get('tab') || 'traces';

  const handleTabChange = (newValue: string) => {
    router.push(`/orgs/${params.organizationId}/telemetry?tab=${newValue}`);
  };

  return (
    <div className="p-4">
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-8">
          <button
            onClick={() => handleTabChange('traces')}
            className={`pb-4 px-1 relative font-semibold text-base ${
              tab === 'traces'
                ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Traces
          </button>
          <button
            onClick={() => handleTabChange('metrics')}
            className={`pb-4 px-1 relative font-semibold text-base ${
              tab === 'metrics'
                ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Metrics
          </button>
          <button
            onClick={() => handleTabChange('logs')}
            className={`pb-4 px-1 relative font-semibold text-base ${
              tab === 'logs'
                ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Logs
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <div role="tabpanel" hidden={tab !== 'traces'}>
          {tab === 'traces' && <TelemetryTracesList organizationId={params.organizationId} />}
        </div>
        <div role="tabpanel" hidden={tab !== 'metrics'}>
          {tab === 'metrics' && <TelemetryMetricsList organizationId={params.organizationId} />}
        </div>
        <div role="tabpanel" hidden={tab !== 'logs'}>
          {tab === 'logs' && <TelemetryLogsList organizationId={params.organizationId} />}
        </div>
      </div>
    </div>
  );
}
