import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  ChevronDownIcon, 
  ArrowPathIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { getLLMResultApi, listPromptsApi, runLLMApi, updateLLMResultApi, listFormsApi, submitFormApi, getDocumentApi } from '@/utils/api';
import type { Prompt, Form } from '@/types/index';
import { useOCR, OCRProvider } from '@/contexts/OCRContext';
import type { GetLLMResultResponse } from '@/types/index';
import type { HighlightInfo } from '@/contexts/OCRContext';
import FormioRenderer from './FormioRenderer';
import { toast } from 'react-toastify';
import { getApiErrorMsg, getFormSubmissionApi, deleteFormSubmissionApi } from '@/utils/api';
import type { FormSubmission } from '@/types/forms';

interface Props {
  organizationId: string;
  id: string;
  onHighlight: (highlight: HighlightInfo) => void;
  onClearHighlight?: () => void;
}

interface EditingState {
  promptId: string;
  key: string;
  value: string;
}

// Update the type definition to handle nested structures
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const PDFFormSidebarContent = ({ organizationId, id, onHighlight }: Props) => {
  const { loadOCRBlocks, findBlocksWithContext } = useOCR();
  const [llmResults, setLlmResults] = useState<Record<string, GetLLMResultResponse>>({});
  const [matchingPrompts, setMatchingPrompts] = useState<Prompt[]>([]);
  const [runningPrompts, setRunningPrompts] = useState<Set<string>>(new Set());
  const [expandedPrompt, setExpandedPrompt] = useState<string>('default');
  const [loadingPrompts, setLoadingPrompts] = useState<Set<string>>(new Set());
  const [failedPrompts, setFailedPrompts] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EditingState | null>(null);
  
  // New state for forms
  const [documentTags, setDocumentTags] = useState<string[]>([]);
  const [availableForms, setAvailableForms] = useState<Form[]>([]);
  const [loadingForms, setLoadingForms] = useState(false);
  const [submittingForms, setSubmittingForms] = useState<Set<string>>(new Set());
  const [existingSubmissions, setExistingSubmissions] = useState<Record<string, FormSubmission>>({});
  const [loadingSubmissions, setLoadingSubmissions] = useState<Set<string>>(new Set());
  const loadingSubmissionsRef = useRef<Set<string>>(new Set());
  const [deletingSubmissions, setDeletingSubmissions] = useState<Set<string>>(new Set());

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

      // Load prompts (existing functionality)
      const promptsResponse = await listPromptsApi({
        organizationId,
        document_id: id,
        limit: 100
      });
      setMatchingPrompts(promptsResponse.prompts);

      // Load existing LLM results
      const loadedResults: Record<string, GetLLMResultResponse> = {};
      for (const prompt of promptsResponse.prompts) {
        try {
          const result = await getLLMResultApi({
            organizationId,
            documentId: id,
            promptId: prompt.prompt_revid
          });
          loadedResults[prompt.prompt_revid] = result;
        } catch {
          // Result doesn't exist yet, that's okay
        }
      }
      setLlmResults(loadedResults);
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

  const handlePromptChange = async (promptId: string) => {
    if (expandedPrompt === promptId) {
      setExpandedPrompt('');
      return;
    }

    setExpandedPrompt(promptId);
    setLoadingPrompts(prev => new Set(prev).add(promptId));

    try {
      const result = await getLLMResultApi({
        organizationId,
        documentId: id,
        promptId
      });
      setLlmResults(prev => ({ ...prev, [promptId]: result }));
    } catch (error) {
      console.error(`Error loading result for prompt ${promptId}:`, error);
      setFailedPrompts(prev => new Set(prev).add(promptId));
    } finally {
      setLoadingPrompts(prev => {
        const newSet = new Set(prev);
        newSet.delete(promptId);
        return newSet;
      });
    }
  };

  const handleRunPrompt = async (promptId: string) => {
    setRunningPrompts(prev => new Set(prev).add(promptId));

    try {
      const result = await runLLMApi({
        organizationId,
        documentId: id,
        promptId,
        force: false
      });
      
      if (result.status === 'success') {
        // Refresh the result
        const updatedResult = await getLLMResultApi({
          organizationId,
          documentId: id,
          promptId
        });
        setLlmResults(prev => ({ ...prev, [promptId]: updatedResult }));
      } else {
        toast.error('Analysis failed');
      }
    } catch (error) {
      console.error(`Error running prompt ${promptId}:`, error);
      toast.error(`Error running analysis: ${getApiErrorMsg(error)}`);
    } finally {
      setRunningPrompts(prev => {
        const newSet = new Set(prev);
        newSet.delete(promptId);
        return newSet;
      });
    }
  };

  const handleFind = (promptId: string, key: string, value: string) => {
    const highlightInfo = findBlocksWithContext(value, promptId, key);
    if (highlightInfo.blocks.length > 0) {
      onHighlight(highlightInfo);
    } else {
      toast.info('No matching text found in document');
    }
  };

  const handleEdit = (promptId: string, key: string, value: string) => {
    setEditing({ promptId, key, value });
  };

  const handleSave = async () => {
    if (!editing) return;

    try {
      const currentResult = llmResults[editing.promptId];
      if (!currentResult) return;

      const updatedResult = { ...currentResult.llm_result };
      
      // Update the nested value
      const keys = editing.key.split('.');
      let current: Record<string, JsonValue> = updatedResult;
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (typeof current[key] === 'object' && current[key] !== null) {
          current = current[key] as Record<string, JsonValue>;
        } else {
          current[key] = {};
          current = current[key] as Record<string, JsonValue>;
        }
      }
      current[keys[keys.length - 1]] = editing.value;

      await updateLLMResultApi({
        organizationId,
        documentId: id,
        promptId: editing.promptId,
        result: updatedResult,
        isVerified: true
      });

      // Update local state
      setLlmResults(prev => ({
        ...prev,
        [editing.promptId]: {
          ...prev[editing.promptId],
          llm_result: updatedResult,
          updated_llm_result: updatedResult,
          is_edited: true,
          is_verified: true
        }
      }));

      setEditing(null);
    } catch (error) {
      console.error('Error updating result:', error);
      toast.error(`Error updating result: ${getApiErrorMsg(error)}`);
    }
  };

  const handleCancel = () => {
    setEditing(null);
  };

  const isEditableValue = (value: unknown): boolean => {
    return typeof value === 'string' || typeof value === 'number';
  };

  const renderNestedValue = (
    promptId: string, 
    parentKey: string, 
    value: JsonValue, 
    level: number = 0,
    onFind: (promptId: string, key: string, value: string) => void,
    onEdit: (promptId: string, key: string, value: string) => void,
    editing: EditingState | null,
    handleSave: () => void,
    handleCancel: () => void,
    editMode: boolean = false
  ) => {
    const indent = '  '.repeat(level);
    const currentKey = parentKey ? `${parentKey}.${parentKey}` : parentKey;

    if (Array.isArray(value)) {
      return (
        <div className="ml-4">
          {value.map((item, index) => (
            <div key={index} className="mb-2">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">{indent}[{index}]:</span>
                {typeof item === 'object' && item !== null ? (
                  renderNestedValue(
                    promptId,
                    `${currentKey}[${index}]`,
                    item,
                    level + 1,
                    onFind,
                    onEdit,
                    editing,
                    handleSave,
                    handleCancel,
                    editMode
                  )
                ) : (
                  <span className="text-gray-700">{String(item)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    } else if (typeof value === 'object' && value !== null) {
      return (
        <div className="ml-4">
          {Object.entries(value).map(([key, val]) => (
            <div key={key} className="mb-2">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">{indent}{key}:</span>
                {typeof val === 'object' && val !== null ? (
                  renderNestedValue(
                    promptId,
                    currentKey ? `${currentKey}.${key}` : key,
                    val,
                    level + 1,
                    onFind,
                    onEdit,
                    editing,
                    handleSave,
                    handleCancel,
                    editMode
                  )
                ) : (
                  <div className="flex items-center gap-2">
                    {editing?.promptId === promptId && editing?.key === (currentKey ? `${currentKey}.${key}` : key) ? (
                      <>
                        <input
                          type="text"
                          value={editing.value}
                          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                          className="border rounded px-2 py-1 text-sm"
                          autoFocus
                        />
                        <button
                          onClick={handleSave}
                          className="text-green-600 hover:text-green-800"
                        >
                          <CheckIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={handleCancel}
                          className="text-red-600 hover:text-red-800"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-gray-700">{String(val)}</span>
                        {isEditableValue(val) && (
                          <>
                            <button
                              onClick={() => onFind(promptId, currentKey ? `${currentKey}.${key}` : key, String(val))}
                              className="text-blue-600 hover:text-blue-800"
                              title="Find in document"
                            >
                              <MagnifyingGlassIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => onEdit(promptId, currentKey ? `${currentKey}.${key}` : key, String(val))}
                              className="text-yellow-600 hover:text-yellow-800"
                              title="Edit value"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    } else {
      return <span className="text-gray-700">{String(value)}</span>;
    }
  };

  const renderPromptResults = (promptId: string) => {
    const result = llmResults[promptId];
    if (!result) return null;

    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-sm">Results</h4>
          <div className="flex items-center gap-2">
            {result.is_verified && (
              <span className="text-green-600 text-xs">✓ Verified</span>
            )}
            {result.is_edited && (
              <span className="text-blue-600 text-xs">✎ Edited</span>
            )}
          </div>
        </div>
        <div className="text-sm">
          {renderNestedValue(
            promptId,
            '',
            result.llm_result,
            0,
            handleFind,
            handleEdit,
            editing,
            handleSave,
            handleCancel
          )}
        </div>
      </div>
    );
  };

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

  // Add useEffect to load existing submissions when forms are loaded
  useEffect(() => {
    if (availableForms.length > 0) {
      availableForms.forEach(form => {
        loadExistingSubmission(form.form_revid);
      });
    }
  }, [availableForms, loadExistingSubmission]);

  // New form handling functions
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
                  <h4 className="font-medium text-sm">{form.name}</h4>
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
                
                <FormioRenderer
                  jsonFormio={JSON.stringify(form.response_format.json_formio || [])}
                  onSubmit={(submission) => handleFormSubmit(form, submission)}
                  readOnly={submittingForms.has(form.form_revid)}
                  initialData={existingSubmissions[form.form_revid]?.submission_data}
                />
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

      {/* Prompts Section (existing functionality) */}
      <div>
        <h3 className="text-lg font-semibold mb-4">LLM Analysis</h3>
        
        {matchingPrompts.length > 0 ? (
          <div className="space-y-4">
            {matchingPrompts.map((prompt) => (
              <div key={prompt.prompt_revid} className="border rounded-lg p-4 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => handlePromptChange(prompt.prompt_revid)}
                    className="flex items-center gap-2 text-left w-full"
                  >
                    <ChevronDownIcon 
                      className={`h-4 w-4 transition-transform ${
                        expandedPrompt === prompt.prompt_revid ? 'rotate-180' : ''
                      }`} 
                    />
                    <span className="font-medium text-sm">{prompt.name}</span>
                  </button>
                  
                  <div className="flex items-center gap-2">
                    {loadingPrompts.has(prompt.prompt_revid) && (
                      <ArrowPathIcon className="h-4 w-4 animate-spin text-blue-500" />
                    )}
                    {failedPrompts.has(prompt.prompt_revid) && (
                      <span className="text-red-500 text-xs">Failed</span>
                    )}
                    <button
                      onClick={() => handleRunPrompt(prompt.prompt_revid)}
                      disabled={runningPrompts.has(prompt.prompt_revid)}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {runningPrompts.has(prompt.prompt_revid) ? 'Running...' : 'Run'}
                    </button>
                  </div>
                </div>
                
                {expandedPrompt === prompt.prompt_revid && renderPromptResults(prompt.prompt_revid)}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No prompts found for this document</p>
            <p className="text-sm mt-1">Create prompts with matching tags to see them here</p>
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
