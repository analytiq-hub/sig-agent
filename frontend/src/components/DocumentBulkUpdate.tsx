import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { Tag } from '@/types/index';

interface DocumentBulkUpdateProps {
  isOpen: boolean
  onClose: () => void
  organizationId: string
  searchParameters: {
    searchTerm: string
    selectedTagFilters: Tag[]
    metadataSearch: string
    paginationModel: { page: number; pageSize: number }
  }
}

export function DocumentBulkUpdate({
  isOpen,
  onClose,
  organizationId,
  searchParameters
}: DocumentBulkUpdateProps) {

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <div className="pointer-events-auto w-screen max-w-md">
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
                    {/* Search Parameters Display */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-3">Current Search Parameters</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Organization ID</label>
                          <div className="p-2 bg-gray-50 rounded border text-sm text-gray-600">
                            {organizationId}
                          </div>
                        </div>

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
                                    className="px-2 py-1 rounded text-xs text-white"
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

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Pagination</label>
                          <div className="p-2 bg-gray-50 rounded border text-sm text-gray-600">
                            Page: {searchParameters.paginationModel.page + 1},
                            Page Size: {searchParameters.paginationModel.pageSize}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Placeholder for future bulk actions */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-3">Available Actions</h3>
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                        <p className="text-sm text-yellow-800">
                          Bulk actions will be implemented here in the future.
                        </p>
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