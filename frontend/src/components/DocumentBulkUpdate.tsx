import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, PlusIcon, MinusIcon } from '@heroicons/react/24/outline'
import { Tag, DocumentMetadata } from '@/types/index';
import { isColorLight } from '@/utils/colors';
import TagSelector from './TagSelector';
import { listDocumentsApi, updateDocumentApi } from '@/utils/api';
import { toast } from 'react-hot-toast';

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
  const [selectedTagsToAdd, setSelectedTagsToAdd] = useState<string[]>([])
  const [selectedTagsToRemove, setSelectedTagsToRemove] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOperationLoading, setIsOperationLoading] = useState(false)
  const [totalDocuments, setTotalDocuments] = useState<number>(0)
  const [processedDocuments, setProcessedDocuments] = useState<number>(0)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [pendingOperation, setPendingOperation] = useState<{operation: string, tagIds: string[]} | null>(null)

  useEffect(() => {
    if (isOpen) {
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

  const handleBulkUpdate = async (operation: string, tagIds: string[]) => {
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
            let updatedTagIds = [...doc.tag_ids];

            if (operation === 'addTags') {
              // Add new tags (avoiding duplicates)
              for (const tagId of tagIds) {
                if (!updatedTagIds.includes(tagId)) {
                  updatedTagIds.push(tagId);
                }
              }
            } else if (operation === 'removeTags') {
              // Remove specified tags
              updatedTagIds = updatedTagIds.filter(tagId => !tagIds.includes(tagId));
            }

            // Always call the update API for every document
            await updateDocumentApi({
              organizationId,
              documentId: doc.id,
              tagIds: updatedTagIds,
              metadata: doc.metadata || {}
            });

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
        const actionWord = operation === 'addTags' ? 'added to' : 'removed from';
        toast.success(`Tags ${actionWord} ${successCount} document${successCount !== 1 ? 's' : ''}`);
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

  const handleAddTags = async () => {
    if (selectedTagsToAdd.length === 0) return

    // Count total documents and show confirmation
    const total = await countTotalMatchingDocuments();
    if (total === 0) {
      toast('No documents match the current filters');
      return;
    }

    setTotalDocuments(total);
    setPendingOperation({ operation: 'addTags', tagIds: selectedTagsToAdd });
    setShowConfirmation(true);
  }

  const handleRemoveTags = async () => {
    if (selectedTagsToRemove.length === 0) return

    // Count total documents and show confirmation
    const total = await countTotalMatchingDocuments();
    if (total === 0) {
      toast('No documents match the current filters');
      return;
    }

    setTotalDocuments(total);
    setPendingOperation({ operation: 'removeTags', tagIds: selectedTagsToRemove });
    setShowConfirmation(true);
  }

  const handleConfirmOperation = async () => {
    if (!pendingOperation) return;

    try {
      setIsOperationLoading(true);
      setShowConfirmation(false);

      await handleBulkUpdate(pendingOperation.operation, pendingOperation.tagIds);

      // Clear selected tags
      if (pendingOperation.operation === 'addTags') {
        setSelectedTagsToAdd([]);
      } else {
        setSelectedTagsToRemove([]);
      }

      // Refresh preview documents
      await fetchPreviewDocuments();
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

  return (
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
                      <h3 className="text-sm font-medium text-gray-900 mb-3">
                        Matching Documents
                        {totalDocuments > 0 && (
                          <span className="text-gray-500 font-normal"> ({totalDocuments} total)</span>
                        )}
                      </h3>
                      {isLoading ? (
                        <div className="p-4 bg-gray-50 rounded border text-sm text-gray-600">
                          Loading preview...
                        </div>
                      ) : previewDocuments.length > 0 ? (
                        <div className="border rounded overflow-hidden">
                          {previewDocuments.map((doc, index) => (
                            <div
                              key={doc.id}
                              className={`p-3 text-sm text-gray-800 border-b border-gray-200 last:border-b-0 ${
                                index % 2 === 1 ? 'bg-gray-50' : 'bg-white'
                              }`}
                            >
                              {doc.document_name}
                            </div>
                          ))}
                          {totalDocuments > 3 && (
                            <div className="p-3 text-sm text-gray-500 bg-gray-100 italic text-center">
                              ... and {totalDocuments - 3} more documents
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-4 bg-gray-50 rounded border text-sm text-gray-600">
                          No matching documents found
                        </div>
                      )}
                    </div>

                    {/* Operations */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-3">Operations</h3>

                      {/* Add Tags */}
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-800 mb-2">Add Tags</h4>
                        <TagSelector
                          availableTags={availableTags}
                          selectedTagIds={selectedTagsToAdd}
                          onChange={setSelectedTagsToAdd}
                        />
                        <button
                          onClick={handleAddTags}
                          disabled={selectedTagsToAdd.length === 0 || isOperationLoading}
                          className="mt-2 inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300 rounded-md"
                        >
                          <PlusIcon className="h-4 w-4 mr-1" />
                          {isOperationLoading ? 'Adding Tags...' : 'Add Selected Tags'}
                        </button>
                      </div>

                      {/* Remove Tags */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-800 mb-2">Remove Tags</h4>
                        <TagSelector
                          availableTags={availableTags}
                          selectedTagIds={selectedTagsToRemove}
                          onChange={setSelectedTagsToRemove}
                        />
                        <button
                          onClick={handleRemoveTags}
                          disabled={selectedTagsToRemove.length === 0 || isOperationLoading}
                          className="mt-2 inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 rounded-md"
                        >
                          <MinusIcon className="h-4 w-4 mr-1" />
                          {isOperationLoading ? 'Removing Tags...' : 'Remove Selected Tags'}
                        </button>
                      </div>
                    </div>

                    {/* Confirmation Dialog */}
                    {showConfirmation && (
                      <div className="border-t border-gray-200 p-4 bg-yellow-50">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-yellow-600" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.345 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-medium text-yellow-800">
                              Confirm Bulk Operation
                            </h3>
                            <p className="text-sm text-yellow-700 mt-1">
                              This will {pendingOperation?.operation === 'addTags' ? 'add tags to' : 'remove tags from'} <strong>{totalDocuments}</strong> document{totalDocuments !== 1 ? 's' : ''}. This operation cannot be undone.
                            </p>
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={handleConfirmOperation}
                                className="px-3 py-1.5 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-md"
                              >
                                Continue
                              </button>
                              <button
                                onClick={handleCancelOperation}
                                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-md"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Progress Indicator */}
                    {isOperationLoading && totalDocuments > 0 && (
                      <div className="border-t border-gray-200 p-4 bg-blue-50">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-blue-800">
                                Processing documents...
                              </span>
                              <span className="text-sm text-blue-600">
                                {processedDocuments} / {totalDocuments}
                              </span>
                            </div>
                            <div className="w-full bg-blue-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${totalDocuments > 0 ? (processedDocuments / totalDocuments) * 100 : 0}%` }}
                              ></div>
                            </div>
                            <p className="text-xs text-blue-600 mt-1">
                              {processedDocuments === totalDocuments && processedDocuments > 0
                                ? 'Finalizing...'
                                : 'Please wait while we update all documents'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-shrink-0 justify-end gap-3 px-4 py-4">
                    <button
                      type="button"
                      className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                      onClick={onClose}
                      disabled={isOperationLoading}
                    >
                      {isOperationLoading ? 'Processing...' : 'Close'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}