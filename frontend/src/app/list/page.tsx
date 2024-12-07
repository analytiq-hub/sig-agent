'use client'

import { useState } from 'react';
import FileList from '@/components/FileList';
import Tags from '@/components/Tags';

export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="container mx-auto p-4">
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab(0)}
            className={`pb-4 px-1 relative font-semibold text-base ${
              activeTab === 0 
                ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Documents
          </button>
          <button
            onClick={() => setActiveTab(1)}
            className={`pb-4 px-1 relative font-semibold text-base ${
              activeTab === 1 
                ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Tags
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        <div role="tabpanel" hidden={activeTab !== 0}>
          {activeTab === 0 && <FileList />}
        </div>
        <div role="tabpanel" hidden={activeTab !== 1}>
          {activeTab === 1 && <Tags />}
        </div>
      </div>
    </div>
  );
}
