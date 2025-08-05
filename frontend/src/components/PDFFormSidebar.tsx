import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  ArrowPathIcon,
  DocumentTextIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { listFormsApi, submitFormApi, getDocumentApi, getLLMResultApi } from '@/utils/api';
import type { Form } from '@/types/index';
import { useOCR, OCRProvider } from '@/contexts/OCRContext';
import type { HighlightInfo } from '@/contexts/OCRContext';
import FormioRenderer from './FormioRenderer';
import { toast } from 'react-toastify';
import { getApiErrorMsg, getFormSubmissionApi, deleteFormSubmissionApi } from '@/utils/api';
import type { FormSubmission, FieldMapping, FieldMappingSource } from '@/types/forms';
import type { GetLLMResultResponse } from '@/types/llm';

interface Props {
  organizationId: string;
  id: string;
  onHighlight: (highlight: HighlightInfo) => void;
  onClearHighlight?: () => void;
}

const PDFFormSidebarContent = ({ organizationId, id, onHighlight }: Props) => {
  const { loadOCRBlocks, findBlocksWithContext } = useOCR();
  
  // Form-related state
  const [documentTags, setDocumentTags] = useState<string[]>([]);
  const [availableForms, setAvailableForms] = useState<Form[]>([]);
  const [loadingForms, setLoadingForms] = useState(false);
  const [submittingForms, setSubmittingForms] = useState<Set<string>>(new Set());
  const [existingSubmissions, setExistingSubmissions] = useState<Record<string, FormSubmission>>({});
  const [loadingSubmissions, setLoadingSubmissions] = useState<Set<string>>(new Set());
  const loadingSubmissionsRef = useRef<Set<string>>(new Set());
  const [deletingSubmissions, setDeletingSubmissions] = useState<Set<string>>(new Set());
  const [llmResults, setLlmResults] = useState<Record<string, GetLLMResultResponse>>({});
  const [llmResultsLoading, setLlmResultsLoading] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      // Get document metadata to access tags
      const documentResponse = await getDocumentApi({ 
        organizationId, 
        documentId: id, 
        fileType: 'original' 
      });
      
      const documentTags = documentResponse.metadata.tag_ids || [];
      setDocumentTags(documentTags);

      // Fetch forms that match the document's tags
      if (documentTags.length > 0) {
        setLoadingForms(true);
        try {
          const formsResponse = await listFormsApi({
            organizationId,
            tag_ids: documentTags.join(','),
            limit: 100
          });
          setAvailableForms(formsResponse.forms);
        } catch (error) {
          console.error('Error loading forms:', error);
          toast.error(`Error loading forms: ${getApiErrorMsg(error)}`);
        } finally {
          setLoadingForms(false);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(`Error loading document data: ${getApiErrorMsg(error)}`);
    }
  }, [organizationId, id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    // Load OCR blocks in the background
    loadOCRBlocks(organizationId, id);
  }, [id, organizationId, loadOCRBlocks]);

  // Add function to load existing submission for a form
  const loadExistingSubmission = useCallback(async (formRevId: string) => {
    if (loadingSubmissionsRef.current.has(formRevId)) return;
    
    loadingSubmissionsRef.current.add(formRevId);
    setLoadingSubmissions(prev => new Set(prev).add(formRevId));
    
    try {
      const submission = await getFormSubmissionApi({
        organizationId,
        documentId: id,
        formRevId
      });
      
      if (submission) {
        setExistingSubmissions(prev => ({
          ...prev,
          [formRevId]: submission
        }));

        console.log('submission', submission);
      }
    } catch (error) {
      console.error('Error loading existing submission:', error);
    } finally {
      loadingSubmissionsRef.current.delete(formRevId);
      setLoadingSubmissions(prev => {
        const newSet = new Set(prev);
        newSet.delete(formRevId);
        return newSet;
      });
    }
  }, [organizationId, id]);

  // Helper function to get value from nested object using path
  const getValueFromPath = (obj: Record<string, unknown>, path: string): unknown => {
    const parts = path.split('.');
    let current: unknown = obj;
    
    for (const part of parts) {
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, fieldName, index] = arrayMatch;
        if (current && typeof current === 'object' && fieldName in current) {
          const fieldValue = (current as Record<string, unknown>)[fieldName];
          if (Array.isArray(fieldValue)) {
            current = fieldValue[parseInt(index)];
          } else {
            current = undefined;
          }
        } else {
          current = undefined;
        }
      } else {
        if (current && typeof current === 'object' && part in current) {
          current = (current as Record<string, unknown>)[part];
        } else {
          current = undefined;
        }
      }
      
      if (current === null || current === undefined) {
        return undefined;
      }
    }
    
    return current;
  };

  // Generate initial form data from LLM results and mappings
  const generateInitialFormData = useCallback((form: Form): Record<string, unknown> => {
    console.log(`Generating initial data for form ${form.name}`);
    const mappings = form.response_format.json_formio_mapping;
    if (!mappings) {
      console.log(`No mappings found for form ${form.name}`);
      return {};
    }

    console.log(`Form ${form.name} mappings:`, mappings);
    console.log(`Available LLM results:`, llmResults);

    const initialData: Record<string, unknown> = {};

    Object.entries(mappings).forEach(([formFieldKey, mapping]: [string, FieldMapping]) => {
      console.log(`Processing field ${formFieldKey}:`, mapping);
      const values: string[] = [];

      mapping.sources.forEach((source: FieldMappingSource) => {
        const llmResult = llmResults[source.promptId];
        console.log(`LLM result for prompt ${source.promptId}:`, llmResult);
        
        if (llmResult) {
          const resultData = llmResult.is_edited ? llmResult.updated_llm_result : llmResult.llm_result;
          console.log(`Result data for path ${source.schemaFieldPath}:`, resultData);
          
          const value = getValueFromPath(resultData as Record<string, unknown>, source.schemaFieldPath);
          console.log(`Extracted value:`, value);
          
          if (value !== null && value !== undefined) {
            const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
            values.push(stringValue);
            console.log(`Added value: ${stringValue}`);
          }
        }
      });

      if (values.length > 0) {
        if (mapping.mappingType === 'concatenated' && values.length > 1) {
          initialData[formFieldKey] = values.join(mapping.concatenationSeparator || ' ');
        } else {
          initialData[formFieldKey] = values[0];
        }
        console.log(`Set field ${formFieldKey} = ${initialData[formFieldKey]}`);
      } else {
        console.log(`No values found for field ${formFieldKey}`);
      }
    });

    console.log(`Final initial data for form ${form.name}:`, initialData);
    return initialData;
  }, [llmResults]);

  // Load LLM result for a specific prompt
  const loadLLMResult = useCallback(async (promptId: string) => {
    if (llmResults[promptId] || llmResultsLoading.has(promptId)) {
      return; // Already loaded or loading
    }

    setLlmResultsLoading(prev => new Set(prev).add(promptId));
    
    try {
      const result = await getLLMResultApi({
        organizationId,
        documentId: id,
        promptId
      });
      
      setLlmResults(prev => ({
        ...prev,
        [promptId]: result
      }));
    } catch (error) {
      console.error(`Error loading LLM result for prompt ${promptId}:`, error);
    } finally {
      setLlmResultsLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(promptId);
        return newSet;
      });
    }
  }, [organizationId, id, llmResults, llmResultsLoading]);

  // Check if a form needs LLM data and if it's ready to render
  const isFormReadyToRender = useCallback((form: Form): boolean => {
    console.log(`Checking if form ${form.name} is ready to render`);
    
    // If there's an existing submission, always render
    if (existingSubmissions[form.form_revid]) {
      console.log(`Form ${form.name} has existing submission - ready to render`);
      return true;
    }

    // If there are no mappings, render immediately
    const mappings = form.response_format.json_formio_mapping;
    if (!mappings) {
      console.log(`Form ${form.name} has no mappings - ready to render`);
      return true;
    }

    // Check if all required LLM results are loaded
    const requiredPromptIds = new Set<string>();
    Object.values(mappings).forEach((mapping: FieldMapping) => {
      mapping.sources.forEach((source: FieldMappingSource) => {
        requiredPromptIds.add(source.promptId);
      });
    });

    console.log(`Form ${form.name} requires LLM results for prompts:`, Array.from(requiredPromptIds));
    console.log(`Current LLM results:`, Object.keys(llmResults));
    console.log(`Currently loading:`, Array.from(llmResultsLoading));

    // All required prompts must have results loaded
    const isReady = Array.from(requiredPromptIds).every(promptId => 
      llmResults[promptId] && !llmResultsLoading.has(promptId)
    );
    
    console.log(`Form ${form.name} ready to render:`, isReady);
    return isReady;
  }, [existingSubmissions, llmResults, llmResultsLoading]);

  // Add useEffect to load existing submissions when forms are loaded
  useEffect(() => {
    if (availableForms.length > 0) {
      availableForms.forEach(form => {
        loadExistingSubmission(form.form_revid);
      });
    }
  }, [availableForms, loadExistingSubmission]);

  // Separate useEffect to load LLM results to avoid infinite loop
  useEffect(() => {
    if (availableForms.length > 0) {
      availableForms.forEach(form => {
        // Load LLM results if form has mappings and no existing submission
        if (!existingSubmissions[form.form_revid]) {
          const mappings = form.response_format.json_formio_mapping;
          if (mappings) {
            const requiredPromptIds = new Set<string>();
            Object.values(mappings).forEach((mapping: FieldMapping) => {
              mapping.sources.forEach((source: FieldMappingSource) => {
                requiredPromptIds.add(source.promptId);
              });
            });
            
            // Load each required LLM result
            requiredPromptIds.forEach(promptId => {
              loadLLMResult(promptId);
            });
          }
        }
      });
    }
  }, [availableForms, existingSubmissions, loadLLMResult]); // Removed loadExistingSubmission to prevent loop

  // Form handling functions
  const handleFormSubmit = async (form: Form, submissionData: unknown) => {
    setSubmittingForms(prev => new Set(prev).add(form.form_revid));

    try {
      const result = await submitFormApi({
        organizationId,
        documentId: id,
        submission: {
          form_revid: form.form_revid,
          submission_data: submissionData as Record<string, unknown>
        }
      });

      // Update the existing submissions state with the new submission
      setExistingSubmissions(prev => ({
        ...prev,
        [form.form_revid]: result
      }));

    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error(`Error submitting form: ${getApiErrorMsg(error)}`);
    } finally {
      setSubmittingForms(prev => {
        const newSet = new Set(prev);
        newSet.delete(form.form_revid);
        return newSet;
      });
    }
  };

  const handleDeleteSubmission = async (formRevId: string) => {
    if (!existingSubmissions[formRevId]) return;
    
    setDeletingSubmissions(prev => new Set(prev).add(formRevId));

    try {
      await deleteFormSubmissionApi({
        organizationId,
        documentId: id,
        formRevId
      });

      // Remove from existing submissions state
      setExistingSubmissions(prev => {
        const newSubmissions = { ...prev };
        delete newSubmissions[formRevId];
        return newSubmissions;
      });

    } catch (error) {
      console.error('Error deleting submission:', error);
      toast.error(`Error deleting submission: ${getApiErrorMsg(error)}`);
    } finally {
      setDeletingSubmissions(prev => {
        const newSet = new Set(prev);
        newSet.delete(formRevId);
        return newSet;
      });
    }
  };

  // Add this function to handle form field search
  const handleFormFieldSearch = (fieldValue: string) => {
    if (!fieldValue || typeof fieldValue !== 'string') {
      toast.info('No text to search');
      return;
    }
    
    const highlightInfo = findBlocksWithContext(fieldValue, 'form', 'field');
    if (highlightInfo.blocks.length > 0) {
      onHighlight(highlightInfo);
    } else {
      toast.info('No matching text found in document');
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      {/* Forms Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <DocumentTextIcon className="h-5 w-5" />
          Forms
        </h3>
        
        {loadingForms ? (
          <div className="flex items-center justify-center py-8">
            <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-500" />
            <span className="ml-2 text-gray-500">Loading forms...</span>
          </div>
        ) : availableForms.length > 0 ? (
          <div className="space-y-4">
            {availableForms.map((form) => (
              <div key={form.form_revid} className="border rounded-lg p-4 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm">{form.name}</h4>
                  <div className="flex items-center gap-2">
                    {loadingSubmissions.has(form.form_revid) && (
                      <ArrowPathIcon className="h-4 w-4 animate-spin text-blue-500" />
                    )}
                    {existingSubmissions[form.form_revid] && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                          Previously submitted
                        </span>
                        <button
                          onClick={() => handleDeleteSubmission(form.form_revid)}
                          disabled={deletingSubmissions.has(form.form_revid)}
                          className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                          title="Delete submission"
                        >
                          {deletingSubmissions.has(form.form_revid) ? (
                            <ArrowPathIcon className="h-3 w-3 animate-spin" />
                          ) : (
                            <XMarkIcon className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    )}
                    {submittingForms.has(form.form_revid) && (
                      <ArrowPathIcon className="h-4 w-4 animate-spin text-blue-500" />
                    )}
                  </div>
                </div>
                
                {isFormReadyToRender(form) ? (
                  <FormioRenderer
                    jsonFormio={JSON.stringify(form.response_format.json_formio || [])}
                    onSubmit={(submission) => handleFormSubmit(form, submission)}
                    readOnly={submittingForms.has(form.form_revid)}
                    initialData={
                      existingSubmissions[form.form_revid]?.submission_data ||
                      generateInitialFormData(form)
                    }
                    onFieldSearch={handleFormFieldSearch}
                  />
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <ArrowPathIcon className="h-4 w-4 animate-spin text-blue-500" />
                    <span className="ml-2 text-gray-500">Loading form data...</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : documentTags.length > 0 ? (
          <div className="text-center py-8 text-gray-500">
            <DocumentTextIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No forms found for this document&apos;s tags</p>
            <p className="text-sm mt-1">Create forms with matching tags to see them here</p>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <DocumentTextIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No tags assigned to this document</p>
            <p className="text-sm mt-1">Add tags to the document to see relevant forms</p>
          </div>
        )}
      </div>
    </div>
  );
};

const PDFFormSidebar = (props: Props) => {
  return (
    <OCRProvider>
      <PDFFormSidebarContent {...props} />
    </OCRProvider>
  );
};

export default PDFFormSidebar;
