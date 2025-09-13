import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, BoltIcon } from '@heroicons/react/24/outline'
import { Tag, DocumentMetadata } from '@/types/index';
import { isColorLight } from '@/utils/colors';
import { listDocumentsApi, updateDocumentApi } from '@/utils/api';
import { toast } from 'react-hot-toast';
import { DocumentBulkUpdateTags } from './DocumentBulkUpdateTags';
import { DocumentBulkUpdateMetadata } from './DocumentBulkUpdateMetadata';

interface DocumentBulkUpdateProps {
  isOpen: boolean
  onClose: () => void
  organizationId: string
  availableTags: Tag[]
  searchParameters: {
    searchTerm: string
    selectedTagFilters: Tag[]
    metadataSearch: string
    paginationModel: { page: number; pageSize: number }
  }
  onRefresh?: () => void
}

export function DocumentBulkUpdate({
  isOpen,
  onClose,
  organizationId,
  availableTags,
  searchParameters,
  onRefresh
}: DocumentBulkUpdateProps) {
  const [previewDocuments, setPreviewDocuments] = useState<DocumentMetadata[]>([])
  // Remove individual state - now handled by sub-components
  const [isLoading, setIsLoading] = useState(false)
  const [isOperationLoading, setIsOperationLoading] = useState(false)
  const [totalDocuments, setTotalDocuments] = useState<number>(0)
  const [processedDocuments, setProcessedDocuments] = useState<number>(0)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [pendingOperation, setPendingOperation] = useState<{operation: string, data: any} | null>(null)
  const [selectedOperation, setSelectedOperation] = useState<string>('addTags')
  const [operationData, setOperationData] = useState<any>(null)

  useEffect(() => {
    if (isOpen) {
      // Reset all state when modal opens to avoid carrying over from previous operations
      // Sub-components handle their own state reset
      setTotalDocuments(0)
      setProcessedDocuments(0)
      setShowConfirmation(false)
      setPendingOperation(null)
      fetchPreviewDocuments()
    }
  }, [isOpen, searchParameters])

  const fetchPreviewDocuments = async () => {
    try {
      setIsLoading(true)

      // Parse and URL-encode metadata search to handle special characters
      const parseAndEncodeMetadataSearch = (searchStr: string): string | null => {
        try {
          const pairs: string[] = [];
          const rawPairs = searchStr.split(',');

          for (const rawPair of rawPairs) {
            const trimmed = rawPair.trim();
            if (!trimmed) continue;

            const equalIndex = trimmed.indexOf('=');
            if (equalIndex === -1) continue;

            const key = trimmed.substring(0, equalIndex).trim();
            const value = trimmed.substring(equalIndex + 1).trim();

            if (key && value) {
              const encodedKey = encodeURIComponent(key);
              const encodedValue = encodeURIComponent(value);
              pairs.push(`${encodedKey}=${encodedValue}`);
            }
          }

          return pairs.length > 0 ? pairs.join(',') : null;
        } catch (error) {
          console.error('Error parsing metadata search:', error);
          return null;
        }
      };

      const response = await listDocumentsApi({
        organizationId,
        skip: 0,
        limit: 3,
        nameSearch: searchParameters.searchTerm.trim() || undefined,
        tagIds: searchParameters.selectedTagFilters.length > 0 ? searchParameters.selectedTagFilters.map(tag => tag.id).join(',') : undefined,
        metadataSearch: searchParameters.metadataSearch.trim() ? parseAndEncodeMetadataSearch(searchParameters.metadataSearch.trim()) || undefined : undefined,
      })
      setPreviewDocuments(response.documents)
      setTotalDocuments(response.total_count)
    } catch (error) {
      console.error('Error fetching preview documents:', error)
      setPreviewDocuments([])
    } finally {
      setIsLoading(false)
    }
  }

  // Parse and URL-encode metadata search to handle special characters
  const parseAndEncodeMetadataSearch = (searchStr: string): string | null => {
    try {
      const pairs: string[] = [];
      const rawPairs = searchStr.split(',');

      for (const rawPair of rawPairs) {
        const trimmed = rawPair.trim();
        if (!trimmed) continue;

        const equalIndex = trimmed.indexOf('=');
        if (equalIndex === -1) continue;

        const key = trimmed.substring(0, equalIndex).trim();
        const value = trimmed.substring(equalIndex + 1).trim();

        if (key && value) {
          const encodedKey = encodeURIComponent(key);
          const encodedValue = encodeURIComponent(value);
          pairs.push(`${encodedKey}=${encodedValue}`);
        }
      }

      return pairs.length > 0 ? pairs.join(',') : null;
    } catch (error) {
      console.error('Error parsing metadata search:', error);
      return null;
    }
  };

  const countTotalMatchingDocuments = async (): Promise<number> => {
    try {
      const response = await listDocumentsApi({
        organizationId,
        skip: 0,
        limit: 1, // We only need the count, not the documents
        nameSearch: searchParameters.searchTerm.trim() || undefined,
        tagIds: searchParameters.selectedTagFilters.length > 0 ? searchParameters.selectedTagFilters.map(tag => tag.id).join(',') : undefined,
        metadataSearch: searchParameters.metadataSearch.trim() ? parseAndEncodeMetadataSearch(searchParameters.metadataSearch.trim()) || undefined : undefined,
      });
      return response.total_count;
    } catch (error) {
      console.error('Error counting documents:', error);
      return 0;
    }
  };

  const handleBulkUpdate = async (operation: string, data: any) => {
    try {
      setProcessedDocuments(0);
      let successCount = 0;
      let failureCount = 0;
      let skip = 0;
      const limit = 100; // Maximum allowed by API

      while (true) {
        // Fetch next batch of documents
        const batchResponse = await listDocumentsApi({
          organizationId,
          skip,
          limit,
          nameSearch: searchParameters.searchTerm.trim() || undefined,
          tagIds: searchParameters.selectedTagFilters.length > 0 ? searchParameters.selectedTagFilters.map(tag => tag.id).join(',') : undefined,
          metadataSearch: searchParameters.metadataSearch.trim() ? parseAndEncodeMetadataSearch(searchParameters.metadataSearch.trim()) || undefined : undefined,
        });

        const documentsInBatch = batchResponse.documents;

        if (documentsInBatch.length === 0) {
          break; // No more documents
        }

        // Update each document in the current batch
        for (const doc of documentsInBatch) {
          try {
            let updatePayload: any = {
              organizationId,
              documentId: doc.id,
            };

            // Handle tag operations
            if (operation === 'addTags') {
              let updatedTagIds = [...doc.tag_ids];
              // Add new tags (avoiding duplicates)
              for (const tagId of data) {
                if (!updatedTagIds.includes(tagId)) {
                  updatedTagIds.push(tagId);
                }
              }
              updatePayload.tagIds = updatedTagIds;
              updatePayload.metadata = doc.metadata || {};
            } else if (operation === 'removeTags') {
              // Remove specified tags
              const updatedTagIds = doc.tag_ids.filter((tagId: string) => !data.includes(tagId));
              updatePayload.tagIds = updatedTagIds;
              updatePayload.metadata = doc.metadata || {};
            }
            // Handle metadata operations
            else if (operation === 'addMetadata') {
              updatePayload.tagIds = doc.tag_ids;
              updatePayload.metadata = { ...(doc.metadata || {}), ...data };
            } else if (operation === 'removeMetadata') {
              updatePayload.tagIds = doc.tag_ids;
              const updatedMetadata = { ...(doc.metadata || {}) };
              // Remove specified keys
              for (const key of data) {
                delete updatedMetadata[key];
              }
              updatePayload.metadata = updatedMetadata;
            } else if (operation === 'clearMetadata') {
              updatePayload.tagIds = doc.tag_ids;
              updatePayload.metadata = {};
            }

            // Always call the update API for every document
            await updateDocumentApi(updatePayload);

            successCount++;
          } catch (error) {
            console.error(`Failed to update document ${doc.document_name}:`, error);
            failureCount++;
          }

          // Update progress
          setProcessedDocuments(successCount + failureCount);
        }

        // If we got less than the limit, we've reached the end
        if (documentsInBatch.length < limit) {
          break;
        }

        // Move to next batch
        skip += limit;
      }

      // Show results
      if (successCount > 0) {
        let message = '';
        switch (operation) {
          case 'addTags':
            message = `Tags added to ${successCount} document${successCount !== 1 ? 's' : ''}`;
            break;
          case 'removeTags':
            message = `Tags removed from ${successCount} document${successCount !== 1 ? 's' : ''}`;
            break;
          case 'addMetadata':
            message = `Metadata added to ${successCount} document${successCount !== 1 ? 's' : ''}`;
            break;
          case 'removeMetadata':
            message = `Metadata removed from ${successCount} document${successCount !== 1 ? 's' : ''}`;
            break;
          case 'clearMetadata':
            message = `All metadata cleared from ${successCount} document${successCount !== 1 ? 's' : ''}`;
            break;
          default:
            message = `Operation completed on ${successCount} document${successCount !== 1 ? 's' : ''}`;
        }
        toast.success(message);
      }

      if (failureCount > 0) {
        toast.error(`Failed to update ${failureCount} document${failureCount !== 1 ? 's' : ''}`);
      }

      // Refresh the parent list and preview
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Bulk update error:', error);
      toast.error('Failed to perform bulk update');
    }
  };

  const handleApplyOperation = async (operation: string, data: any) => {
    // Count total documents and show confirmation
    const total = await countTotalMatchingDocuments();
    if (total === 0) {
      toast('No documents match the current filters');
      return;
    }

    setTotalDocuments(total);
    setPendingOperation({ operation, data });
    setShowConfirmation(true);
  }

  const handleConfirmOperation = async () => {
    if (!pendingOperation) return;

    try {
      setIsOperationLoading(true);
      setShowConfirmation(false);

      await handleBulkUpdate(pendingOperation.operation, pendingOperation.data);

      // Sub-components handle their own state clearing

      // Refresh preview documents
      await fetchPreviewDocuments();

      // Close the modal after successful operation
      onClose();
    } finally {
      setIsOperationLoading(false);
      setPendingOperation(null);
      setProcessedDocuments(0);
    }
  }

  const handleCancelOperation = () => {
    setShowConfirmation(false);
    setPendingOperation(null);
    setTotalDocuments(0);
    setProcessedDocuments(0);
  }

  const getOperationData = () => {
    return operationData;
  }

  const canApplyOperation = () => {
    if (totalDocuments === 0) return false;
    
    switch (selectedOperation) {
      case 'addTags':
      case 'removeTags':
        return operationData && Array.isArray(operationData) && operationData.length > 0;
      case 'addMetadata':
        return operationData && typeof operationData === 'object' && Object.keys(operationData).length > 0;
      case 'removeMetadata':
        return operationData && Array.isArray(operationData) && operationData.length > 0;
      case 'clearMetadata':
        return true; // Clear all is always available when there are documents
      default:
        return false;
    }
  }

  return (
    <>
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <div className="pointer-events-auto w-screen max-w-4xl">
                <div className="flex h-full flex-col bg-white shadow-xl">
                  <div className="px-4 py-6 sm:px-6">
                    <div className="flex items-start justify-between">
                      <h2 className="text-base font-semibold leading-6 text-gray-900">
                        Bulk Document Actions
                      </h2>
                      <button
                        type="button"
                        className="rounded-md text-gray-400 hover:text-gray-500"
                        onClick={onClose}
                      >
                        <XMarkIcon className="h-6 w-6" />
                      </button>
                    </div>
                    <span className="text-sm text-gray-500">Perform actions on filtered documents</span>
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 sm:px-6 space-y-6">
                    {/* Current Filters Display */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-3">Current Filters</h3>
                      <div className="p-3 bg-gray-50 rounded border text-sm text-gray-600">
                        <div className="flex flex-wrap items-center gap-4">
                          {/* Search Term */}
                          {searchParameters.searchTerm && (
                            <div className="flex items-center gap-1">
                              <span className="font-medium text-gray-700">Search:</span>
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                                "{searchParameters.searchTerm}"
                              </span>
                            </div>
                          )}

                          {/* Tag Filters */}
                          {searchParameters.selectedTagFilters.length > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="font-medium text-gray-700">Tags:</span>
                              <div className="flex flex-wrap gap-1">
                                {searchParameters.selectedTagFilters.map(tag => (
                                  <span
                                    key={tag.id}
                                    className={`px-2 py-0.5 rounded text-xs ${
                                      isColorLight(tag.color) ? 'text-gray-800' : 'text-white'
                                    }`}
                                    style={{ backgroundColor: tag.color }}
                                  >
                                    {tag.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Metadata Search */}
                          {searchParameters.metadataSearch && (
                            <div className="flex items-center gap-1">
                              <span className="font-medium text-gray-700">Metadata:</span>
                              <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                                {searchParameters.metadataSearch}
                              </span>
                            </div>
                          )}

                          {/* Show "(none)" if no filters */}
                          {!searchParameters.searchTerm &&
                           searchParameters.selectedTagFilters.length === 0 &&
                           !searchParameters.metadataSearch && (
                            <span className="text-gray-500 italic">(no active filters)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Preview Documents */}
                    <div>
                      {isLoading ? (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Matching Documents:</span> Loading preview...
                        </div>
                      ) : previewDocuments.length > 0 ? (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium text-gray-900">
                            Matching Documents ({totalDocuments} total):
                          </span>{' '}
                          {previewDocuments.slice(0, 2).map((doc, index) => (
                            <span key={doc.id}>
                              {index > 0 && ', '}
                              <span className="text-gray-800">{doc.document_name}</span>
                            </span>
                          ))}
                          {totalDocuments > 2 && (
                            <span className="text-gray-500">, ...</span>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium text-gray-900">Matching Documents (0 total):</span> 0
                        </div>
                      )}
                    </div>

                    {/* Operations */}
                    <div className="border border-gray-200 rounded-lg bg-gray-50 p-4">
                      <h3 className="text-sm font-medium text-gray-900 mb-4">Operations</h3>

                      {/* Operation Selector and Apply Button */}
                      <div className="flex items-center gap-3 mb-4">
                        <select
                          value={selectedOperation}
                          onChange={(e) => setSelectedOperation(e.target.value)}
                          disabled={totalDocuments === 0}
                          className={`px-4 py-3 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 ${
                            totalDocuments === 0
                              ? 'text-gray-400 bg-gray-200 cursor-not-allowed'
                              : 'text-white bg-blue-600 hover:bg-blue-700'
                          }`}
                          style={{ width: 'fit-content', minWidth: '200px' }}
                        >
                          <option value="addTags">Add Tags</option>
                          <option value="removeTags">Remove Tags</option>
                          <option value="addMetadata">Add Metadata</option>
                          <option value="removeMetadata">Remove Metadata</option>
                          <option value="clearMetadata">Clear All Metadata</option>
                        </select>

                        <button
                          onClick={() => handleApplyOperation(selectedOperation, getOperationData())}
                          disabled={totalDocuments === 0 || !canApplyOperation()}
                          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 ${
                            totalDocuments === 0 || !canApplyOperation()
                              ? 'text-gray-400 bg-gray-200 cursor-not-allowed border-2 border-gray-200'
                              : 'text-blue-600 bg-white border-2 border-blue-600 hover:bg-blue-50'
                          }`}
                        >
                          <BoltIcon className="h-5 w-5" />
                          Apply
                        </button>
                      </div>

                      {/* Dynamic Content Area */}
                      <div className="border border-gray-300 rounded-md bg-white p-3">
                        {(selectedOperation === 'addTags' || selectedOperation === 'removeTags') && (
                          <DocumentBulkUpdateTags
                            availableTags={availableTags}
                            totalDocuments={totalDocuments}
                            onDataChange={setOperationData}
                            disabled={isOperationLoading}
                            selectedOperation={selectedOperation}
                          />
                        )}
                        
                        {(selectedOperation === 'addMetadata' || selectedOperation === 'removeMetadata' || selectedOperation === 'clearMetadata') && (
                          <DocumentBulkUpdateMetadata
                            totalDocuments={totalDocuments}
                            onDataChange={setOperationData}
                            disabled={isOperationLoading}
                            selectedOperation={selectedOperation}
                          />
                        )}
                      </div>
                    </div>

                  </div>

                  <div className="flex flex-shrink-0 justify-end gap-3 px-4 py-4">
                    <button
                      type="button"
                      className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                      onClick={onClose}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition>

    {/* Confirmation Modal */}
    <Transition show={showConfirmation} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleCancelOperation}>
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-yellow-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.345 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    Confirm Bulk Operation
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      This will {pendingOperation?.operation.replace(/([A-Z])/g, ' $1').toLowerCase()} <strong>{totalDocuments}</strong> document{totalDocuments !== 1 ? 's' : ''}. This operation cannot be undone.
                    </p>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2"
                      onClick={handleConfirmOperation}
                    >
                      Continue
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      onClick={handleCancelOperation}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </Transition>

    {/* Progress Modal */}
    <Transition show={isOperationLoading && totalDocuments > 0} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => {}}>
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <div className="flex-1">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    Processing Documents
                  </Dialog.Title>
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Progress
                      </span>
                      <span className="text-sm text-gray-600">
                        {processedDocuments} / {totalDocuments}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${totalDocuments > 0 ? (processedDocuments / totalDocuments) * 100 : 0}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {processedDocuments === totalDocuments && processedDocuments > 0
                        ? 'Finalizing...'
                        : 'Please wait while we update all documents'}
                    </p>
                  </div>
                </div>
              </div>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </Transition>
    </>
  )
}