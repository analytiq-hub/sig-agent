'use client'

import AnalyticsDashboard from '@/components/AnalyticsDashboard';

const AnalyticsPage: React.FC<{ params: { organizationId: string } }> = ({ params }) => {
  return (
    <div className="container mx-auto p-4">
      <AnalyticsDashboard organizationId={params.organizationId} />
    </div>
  );
};

export default AnalyticsPage;
