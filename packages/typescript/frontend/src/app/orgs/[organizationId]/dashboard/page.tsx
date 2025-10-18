'use client'

import Dashboard from '@/components/Dashboard';

const DashboardPage: React.FC<{ params: { organizationId: string } }> = ({ params }) => {
  return (
    <div className="container mx-auto p-4">
      <Dashboard organizationId={params.organizationId} />
    </div>
  );
};

export default DashboardPage;
