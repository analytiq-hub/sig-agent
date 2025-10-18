'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { DocRouterOrgApi } from '@/utils/api';
import Link from 'next/link';
import { 
  Description as DocumentIcon,
  Schema as SchemaIcon,
  Psychology as PromptIcon,
  Label as TagIcon,
  Assignment as FormIcon
} from '@mui/icons-material';

interface DashboardProps {
  organizationId: string;
}

interface DashboardStats {
  documents: number;
  schemas: number;
  prompts: number;
  tags: number;
  forms: number;
}

const Dashboard: React.FC<DashboardProps> = ({ organizationId }) => {
  const docRouterOrgApi = useMemo(() => new DocRouterOrgApi(organizationId), [organizationId]);
  const [stats, setStats] = useState<DashboardStats>({
    documents: 0,
    schemas: 0,
    prompts: 0,
    tags: 0,
    forms: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const [documentsRes, schemasRes, promptsRes, tagsRes, formsRes] = await Promise.all([
          docRouterOrgApi.listDocuments({ limit: 1 }),
          docRouterOrgApi.listSchemas({ limit: 1 }),
          docRouterOrgApi.listPrompts({ limit: 1 }),
          docRouterOrgApi.listTags({ limit: 1 }),
          docRouterOrgApi.listForms({ limit: 1 })
        ]);

        setStats({
          documents: documentsRes.total_count,
          schemas: schemasRes.total_count,
          prompts: promptsRes.total_count,
          tags: tagsRes.total_count,
          forms: formsRes.total_count
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [docRouterOrgApi]);

  const widgets = [
    {
      title: 'Documents',
      count: stats.documents,
      icon: DocumentIcon,
      href: `/orgs/${organizationId}/docs`,
      color: 'bg-blue-500',
      description: 'Uploaded documents'
    },
    {
      title: 'Schemas',
      count: stats.schemas,
      icon: SchemaIcon,
      href: `/orgs/${organizationId}/schemas`,
      color: 'bg-green-500',
      description: 'Data schemas'
    },
    {
      title: 'Prompts',
      count: stats.prompts,
      icon: PromptIcon,
      href: `/orgs/${organizationId}/prompts`,
      color: 'bg-purple-500',
      description: 'AI prompts'
    },
    {
      title: 'Tags',
      count: stats.tags,
      icon: TagIcon,
      href: `/orgs/${organizationId}/tags`,
      color: 'bg-orange-500',
      description: 'Document tags'
    },
    {
      title: 'Forms',
      count: stats.forms,
      icon: FormIcon,
      href: `/orgs/${organizationId}/forms`,
      color: 'bg-red-500',
      description: 'Data forms'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h2>
        <p className="text-gray-600">
          Overview of your organization&apos;s resources.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {widgets.map((widget) => {
          const Icon = widget.icon;
          return (
            <Link
              key={widget.title}
              href={widget.href}
              className="block bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${widget.color}`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">
                    {loading ? '...' : stats[widget.title.toLowerCase() as keyof DashboardStats]}
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {widget.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {widget.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;