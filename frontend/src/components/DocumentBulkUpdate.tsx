import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, PlusIcon, MinusIcon } from '@heroicons/react/24/outline'
import { Tag, DocumentMetadata } from '@/types/index';
import { isColorLight } from '@/utils/colors';
import TagSelector from './TagSelector';
import { listDocumentsApi } from '@/utils/api';

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
  onBulkUpdate: (operation: string, tagIds: string[]) => Promise<void>
}

export function DocumentBulkUpdate({
  isOpen,
  onClose,
  organizationId,
  availableTags,
  searchParameters,
  onBulkUpdate
}: DocumentBulkUpdateProps) {
  const [previewDocuments, setPreviewDocuments] = useState<DocumentMetadata[]>([])
  const [selectedTagsToAdd, setSelectedTagsToAdd] = useState<string[]>([])
  const [selectedTagsToRemove, setSelectedTagsToRemove] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOperationLoading, setIsOperationLoading] = useState(false)

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
    } catch (error) {
      console.error('Error fetching preview documents:', error)
      setPreviewDocuments([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddTags = async () => {
    if (selectedTagsToAdd.length === 0) return
    try {
      setIsOperationLoading(true)
      await onBulkUpdate('addTags', selectedTagsToAdd)
      setSelectedTagsToAdd([])
      // Refresh preview documents
      await fetchPreviewDocuments()
    } finally {
      setIsOperationLoading(false)
    }
  }

  const handleRemoveTags = async () => {
    if (selectedTagsToRemove.length === 0) return
    try {
      setIsOperationLoading(true)
      await onBulkUpdate('removeTags', selectedTagsToRemove)
      setSelectedTagsToRemove([])
      // Refresh preview documents
      await fetchPreviewDocuments()
    } finally {
      setIsOperationLoading(false)
    }
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
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Search Term</label>
                          <div className="p-2 bg-gray-50 rounded border text-sm text-gray-600">
                            {searchParameters.searchTerm || '(none)'}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Selected Tag Filters</label>
                          <div className="p-2 bg-gray-50 rounded border text-sm text-gray-600">
                            {searchParameters.selectedTagFilters.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {searchParameters.selectedTagFilters.map(tag => (
                                  <span
                                    key={tag.id}
                                    className={`px-2 py-1 rounded text-xs ${
                                      isColorLight(tag.color) ? 'text-gray-800' : 'text-white'
                                    }`}
                                    style={{ backgroundColor: tag.color }}
                                  >
                                    {tag.name}
                                  </span>
                                ))}
                              </div>
                            ) : '(none)'}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Metadata Search</label>
                          <div className="p-2 bg-gray-50 rounded border text-sm text-gray-600">
                            {searchParameters.metadataSearch || '(none)'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Preview Documents */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-3">Matching Documents (first 3)</h3>
                      {isLoading ? (
                        <div className="p-4 bg-gray-50 rounded border text-sm text-gray-600">
                          Loading preview...
                        </div>
                      ) : previewDocuments.length > 0 ? (
                        <div className="space-y-2">
                          {previewDocuments.map(doc => (
                            <div key={doc.id} className="p-2 bg-gray-50 rounded border text-sm text-gray-600">
                              {doc.document_name}
                            </div>
                          ))}
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
  )
}