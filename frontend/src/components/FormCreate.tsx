'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createFormApi, updateFormApi, listTagsApi, getFormApi } from '@/utils/api';
import { FormConfig, Tag } from '@/types/forms';
import { getApiErrorMsg } from '@/utils/api';
import TagSelector from './TagSelector';
import { toast } from 'react-toastify';
import { useRouter } from 'next/navigation';
import FormioBuilder from './FormioBuilder';

const FormCreate: React.FC<{ organizationId: string, formId?: string }> = ({ organizationId, formId }) => {
  const router = useRouter();
  const [currentFormId, setCurrentFormId] = useState<string | null>(null);
  const [currentForm, setCurrentForm] = useState<FormConfig>({
    name: '',
    response_format: {
      json_form: {
        name: '',
        form: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false
        },
        strict: true
      },
      json_formio: []
    },
    tag_ids: [] // Initialize with empty array
  });
  const [isLoading, setIsLoading] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Load editing form if available
  useEffect(() => {
    const loadForm = async () => {
      if (formId) {
        try {
          setIsLoading(true);
          const form = await getFormApi({ organizationId, formRevId: formId });
          setCurrentFormId(form.form_id);
          setCurrentForm({
            name: form.name,
            response_format: form.response_format,
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
  }, [formId, organizationId]);

  const loadTags = useCallback(async () => {
    try {
      const response = await listTagsApi({ organizationId: organizationId });
      setAvailableTags(response.tags);
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error loading tags';
      toast.error('Error: ' + errorMsg);
    }
  }, [organizationId]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

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
        await updateFormApi({
          organizationId: organizationId, 
          formId: currentFormId, 
          form: formToSave
        });
      } else {
        // Create new form
        await createFormApi({
          organizationId: organizationId, 
          ...formToSave
        });
      }

      // Clear the form
      setCurrentForm({
        name: '',
        response_format: {
          json_form: {
            name: '',
            form: {
              type: 'object',
              properties: {},
              required: [],
              additionalProperties: false
            },
            strict: true
          },
          json_formio: []
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentForm.name) {
      toast.error('Please fill in the form name');
      return;
    }

    saveForm();
  };

  return (
    <div className="p-4 w-full">
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-bold mb-4">
          {currentFormId ? 'Edit Form' : 'Create Form'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Form Name Input */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
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
                      json_form: {
                        name: '',
                        form: {
                          type: 'object',
                          properties: {},
                          required: [],
                          additionalProperties: false
                        },
                        strict: true
                      },
                      json_formio: []
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
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={isLoading}
              >
                {currentFormId ? 'Update Form' : 'Save Form'}
              </button>
            </div>
          </div>

          {/* Form Builder */}
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

          {/* Tags Section */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Tags
            </label>
            <TagSelector
              availableTags={availableTags}
              selectedTagIds={selectedTagIds}
              onChange={setSelectedTagIds}
              disabled={isLoading}
            />
          </div>
        </form>
      </div>
    </div>
  );
};

export default FormCreate;