import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  ArrowPathIcon,
  DocumentTextIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { listFormsApi, submitFormApi, getDocumentApi } from '@/utils/api';
import type { Form } from '@/types/index';
import { useOCR, OCRProvider } from '@/contexts/OCRContext';
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
                  onFieldSearch={handleFormFieldSearch}
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
