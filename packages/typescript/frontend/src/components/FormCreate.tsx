'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SigAgentOrgApi } from '@/utils/api';
import { Form } from '@sigagent/sdk';

// Type alias for form creation/update (without id and timestamps)
type FormConfig = Omit<Form, 'form_revid' | 'form_id' | 'form_version' | 'created_at' | 'created_by'>;
import { Tag } from '@sigagent/sdk';
import { getApiErrorMsg } from '@/utils/api';
import TagSelector from './TagSelector';
import { toast } from 'react-toastify';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const FormioBuilder = dynamic(() => import('./FormioBuilder'), {
  ssr: false,
  loading: () => <div className="h-64 flex items-center justify-center">Loading form builder...</div>
});

const FormioMapper = dynamic(() => import('./FormioMapper'), {
  ssr: false,
  loading: () => <div className="h-64 flex items-center justify-center">Loading form mapper...</div>
});

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="h-64 flex items-center justify-center">Loading editor...</div>
});
import InfoTooltip from '@/components/InfoTooltip';
import { FormComponent } from '@/types/ui';

const FormCreate: React.FC<{ organizationId: string, formId?: string }> = ({ organizationId, formId }) => {
  const router = useRouter();
  const sigAgentOrgApi = useMemo(() => new SigAgentOrgApi(organizationId), [organizationId]);
  const [currentFormId, setCurrentFormId] = useState<string | null>(null);
  const [currentForm, setCurrentForm] = useState<FormConfig>({
    name: '',
    response_format: {
      json_formio: [],
      json_formio_mapping: {}
    },
    tag_ids: [] // Initialize with empty array
  });
  const [isLoading, setIsLoading] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'builder' | 'mapper' | 'json'>('builder');
  const [jsonForm, setJsonForm] = useState('');

  // Load editing form if available
  useEffect(() => {
    const loadForm = async () => {
      if (formId) {
        try {
          setIsLoading(true);
          const form = await sigAgentOrgApi.getForm({ formRevId: formId });
          setCurrentFormId(form.form_id);
          setCurrentForm({
            name: form.name,
            response_format: {
              ...form.response_format,
              json_formio_mapping: form.response_format.json_formio_mapping || {}
            },
            tag_ids: form.tag_ids || []
          });
          setSelectedTagIds(form.tag_ids || []);
        } catch (error) {
          toast.error(`Error loading form for editing: ${getApiErrorMsg(error)}`);
        } finally {
          setIsLoading(false);
        }
      }
    };
    loadForm();
  }, [formId, sigAgentOrgApi]);

  const loadTags = useCallback(async () => {
    try {
      const response = await sigAgentOrgApi.listTags({});
      setAvailableTags(response.tags);
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error loading tags';
      toast.error('Error: ' + errorMsg);
    }
  }, [sigAgentOrgApi]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  // Update jsonForm when currentForm changes
  useEffect(() => {
    setJsonForm(JSON.stringify(currentForm.response_format, null, 2));
  }, [currentForm]);

  // Add handler for JSON form changes
  const handleJsonFormChange = (value: string | undefined) => {
    if (!value) return;
    try {
      const parsedForm = JSON.parse(value);
      
      // Validate form structure
      if (!parsedForm.json_formio) {
        toast.error('Error: Invalid form format. Must contain json_formio');
        return;
      }
      
      // Update form (preserve existing mapping if not provided in JSON)
      setCurrentForm(prev => ({
        ...prev,
        response_format: {
          json_formio: parsedForm.json_formio,
          json_formio_mapping: parsedForm.json_formio_mapping || prev.response_format.json_formio_mapping || {}
        }
      }));
    } catch (error) {
      // Invalid JSON - don't update
      toast.error(`Error: Invalid JSON syntax: ${error}`);
    }
  };

  const saveForm = async () => {
    try {
      setIsLoading(true);
      
      // Create the form object with tag_ids
      const formToSave = {
        ...currentForm,
        tag_ids: selectedTagIds
      };

      if (currentFormId) {
        // Update existing form
        await sigAgentOrgApi.updateForm({
          formId: currentFormId, 
          form: formToSave
        });
      } else {
        // Create new form
        await sigAgentOrgApi.createForm(formToSave);
      }

      // Clear the form
      setCurrentForm({
        name: '',
        response_format: {
          json_formio: [],
          json_formio_mapping: {}
        },
        tag_ids: []
      });
      setCurrentFormId(null);
      setSelectedTagIds([]);

      router.push(`/orgs/${organizationId}/forms`);
      
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error saving form';
      toast.error('Error: ' + errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 w-full">
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="hidden md:flex items-center gap-2 mb-4">
          <h2 className="text-xl font-bold">
            {currentFormId ? 'Edit Form' : 'Create Form'}
          </h2>
          <InfoTooltip 
            title="About Forms"
            content={
              <>
                <p className="mb-2">
                  Forms are used to validate and structure data extracted from documents.
                </p>
                <ul className="list-disc list-inside space-y-1 mb-2">
                  <li>Use descriptive field names</li>
                  <li>Choose appropriate data types for each field</li>
                  <li>All fields defined in a form are required by default</li>
                </ul>
              </>
            }
          />
        </div>
        
        <div className="space-y-4">
          {/* Form Name Input */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 md:w-1/2 md:max-w-[calc(50%-1rem)]">
              <input
                type="text"
                className="w-full p-2 border rounded"
                value={currentForm.name}
                onChange={e => setCurrentForm({ ...currentForm, name: e.target.value })}
                placeholder="Form Name"
                disabled={isLoading}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setCurrentFormId(null);
                  setCurrentForm({
                    name: '',
                    response_format: {
                      json_formio: [],
                      json_formio_mapping: {}
                    },
                    tag_ids: []
                  });
                  setSelectedTagIds([]);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                disabled={isLoading}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!currentForm.name) {
                    toast.error('Please fill in the form name');
                    return;
                  }
                  saveForm();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={isLoading}
              >
                {currentFormId ? 'Update Form' : 'Save Form'}
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-4">
            <div className="flex gap-8">
              <button
                type="button"
                onClick={() => setActiveTab('builder')}
                className={`pb-4 px-1 relative font-semibold text-base ${
                  activeTab === 'builder'
                    ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Form Builder
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('mapper')}
                className={`pb-4 px-1 relative font-semibold text-base ${
                  activeTab === 'mapper'
                    ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Form Mapper
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('json')}
                className={`pb-4 px-1 relative font-semibold text-base ${
                  activeTab === 'json'
                    ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                JSON Form
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="space-y-4">
            {activeTab === 'builder' ? (
              // Form Builder Tab
              <div className="border rounded-lg overflow-hidden bg-white">
                <FormioBuilder
                  jsonFormio={JSON.stringify(currentForm.response_format.json_formio || [])}
                  onChange={(components) => {
                    setCurrentForm(prev => ({
                      ...prev,
                      response_format: {
                        ...prev.response_format,
                        json_formio: components
                      }
                    }));
                  }}
                />
              </div>
            ) : activeTab === 'mapper' ? (
              // Form Mapper Tab
              <FormioMapper
                organizationId={organizationId}
                selectedTagIds={selectedTagIds}
                formComponents={currentForm.response_format.json_formio as FormComponent[] || []}
                fieldMappings={currentForm.response_format.json_formio_mapping || {}}
                onMappingChange={(mappings) => {
                  setCurrentForm(prev => ({
                    ...prev,
                    response_format: {
                      ...prev.response_format,
                      json_formio_mapping: mappings
                    }
                  }));
                }}
              />
            ) : (
              // JSON Form Tab
              <div className="h-[calc(100vh-300px)] border rounded">
                <Editor
                  height="100%"
                  defaultLanguage="json"
                  value={jsonForm}
                  onChange={handleJsonFormChange}
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                    wrappingIndent: "indent",
                    lineNumbers: "on",
                    folding: true,
                    renderValidationDecorations: "on"
                  }}
                  theme="vs-light"
                />
              </div>
            )}
          </div>

          {/* Tags Section - moved to bottom like in PromptCreate */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Tags
            </label>
            <div className="w-full md:w-1/4">
              <TagSelector
                availableTags={availableTags}
                selectedTagIds={selectedTagIds}
                onChange={setSelectedTagIds}
                disabled={isLoading}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormCreate;