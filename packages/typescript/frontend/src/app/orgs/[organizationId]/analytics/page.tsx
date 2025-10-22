'use client'

import TelemetryAnalyticsDashboard from '@/components/TelemetryAnalyticsDashboard';

const AnalyticsPage: React.FC<{ params: { organizationId: string } }> = ({ params }) => {
  return (
    <div className="container mx-auto p-4">
      <TelemetryAnalyticsDashboard organizationId={params.organizationId} />
    </div>
  );
};

export default AnalyticsPage;
