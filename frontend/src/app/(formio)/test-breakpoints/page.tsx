'use client';

import React from 'react';
import FormioBuilder from '@/components/FormioBuilder';
import type { Form } from 'formiojs';

export default function TestBreakpointsPage() {
  const [formSchema, setFormSchema] = React.useState<string>('');

  const handleFormChange = (schema: Form | object) => {
    setFormSchema(JSON.stringify(schema, null, 2));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Formio Breakpoint Test
          </h1>
          <p className="text-gray-600 mb-4">
            This page tests the compatibility between Tailwind and Formio breakpoints.
            Resize your browser window to see how the form builder responds.
          </p>

          Testing 1 2 3
          
          {/* Responsive info box similar to FormList */}
          <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200 text-blue-800 hidden md:block">
            <p className="text-sm">
              This info box is hidden on mobile and visible on medium screens and up. 
              It demonstrates responsive visibility similar to the FormList component.
            </p>
          </div>
          
          {/* Responsive text elements similar to Layout */}
          <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-green-800">
              <span className="block sm:hidden">Mobile: Short Text</span>
              <span className="hidden sm:block">Desktop: Longer descriptive text that shows on small screens and up</span>
            </div>
          </div>

          Testing 4 5 6
          
          {/* Test responsive classes */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-100 p-4 rounded">
              <h3 className="font-semibold">Tailwind Responsive Test</h3>
              <p className="text-sm text-gray-600">
                This should work with Tailwind&apos;s responsive classes
              </p>
            </div>
            <div className="bg-green-100 p-4 rounded">
              <h3 className="font-semibold">Formio Container</h3>
              <p className="text-sm text-gray-600">
                Formio should use compatible breakpoints
              </p>
            </div>
            <div className="bg-yellow-100 p-4 rounded">
              <h3 className="font-semibold">Breakpoint Compatibility</h3>
              <p className="text-sm text-gray-600">
                Both systems should work together
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Form Builder
            </h2>
            <p className="text-gray-600 mt-2">
              The form builder below should work properly with responsive breakpoints.
            </p>
          </div>
          
          <div className="p-6">
            <FormioBuilder
              jsonFormio={formSchema}
              onChange={handleFormChange}
            />
          </div>
        </div>

        {formSchema && (
          <div className="mt-6 bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Generated Schema
              </h3>
            </div>
            <div className="p-6">
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {formSchema}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 