import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Tag } from '@/types/index';
import TagSelector from './TagSelector';

interface DocumentUpdateProps {
  isOpen: boolean
  onClose: () => void
  documentName: string
  currentTags: string[]
  currentMetadata?: Record<string, string>
  availableTags: Tag[]
  onSave: (tagIds: string[], metadata: Record<string, string>) => Promise<void>
}

export function DocumentUpdate({ 
  isOpen, 
  onClose, 
  documentName, 
  currentTags, 
  currentMetadata = {},
  availableTags,
  onSave 
}: DocumentUpdateProps) {
  const [selectedTags, setSelectedTags] = useState(currentTags)
  const [metadata, setMetadata] = useState<Record<string, string>>(currentMetadata)

  const handleAddMetadata = () => {
    setMetadata(prev => ({ ...prev, '': '' }))
  }

  const handleRemoveMetadata = (key: string) => {
    setMetadata(prev => {
      const newMetadata = { ...prev }
      delete newMetadata[key]
      return newMetadata
    })
  }

  const handleMetadataKeyChange = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return
    setMetadata(prev => {
      const newMetadata = { ...prev }
      const value = newMetadata[oldKey]
      delete newMetadata[oldKey]
      if (newKey && !newMetadata[newKey]) {
        newMetadata[newKey] = value || ''
      }
      return newMetadata
    })
  }

  const handleMetadataValueChange = (key: string, value: string) => {
    setMetadata(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleSave = async () => {
    // Filter out empty keys
    const cleanMetadata = Object.fromEntries(
      Object.entries(metadata).filter(([key, value]) => key.trim() !== '')
    )
    await onSave(selectedTags, cleanMetadata);
    onClose();
  };

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
                        Update Document: {documentName}
                      </h2>
                      <button
                        type="button"
                        className="rounded-md text-gray-400 hover:text-gray-500"
                        onClick={onClose}
                      >
                        <XMarkIcon className="h-6 w-6" />
                      </button>
                    </div>
                    <span className="text-sm text-gray-500">Click on tags to enable or disable them</span>
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 sm:px-6 space-y-6">
                    {/* Tags Section */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-3">Tags</h3>
                      <TagSelector
                        availableTags={availableTags}
                        selectedTagIds={selectedTags}
                        onChange={setSelectedTags}
                      />
                    </div>

                    {/* Metadata Section */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-gray-900">Metadata</h3>
                        <button
                          type="button"
                          onClick={handleAddMetadata}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-500"
                        >
                          <PlusIcon className="h-4 w-4 mr-1" />
                          Add Field
                        </button>
                      </div>
                      
                      <div className="space-y-2">
                        {Object.entries(metadata).map(([key, value], index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <input
                              type="text"
                              placeholder="Key"
                              value={key}
                              onChange={(e) => handleMetadataKeyChange(key, e.target.value)}
                              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            />
                            <input
                              type="text"
                              placeholder="Value"
                              value={value}
                              onChange={(e) => handleMetadataValueChange(key, e.target.value)}
                              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveMetadata(key)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        {Object.keys(metadata).length === 0 && (
                          <p className="text-sm text-gray-500 italic">No metadata fields. Click "Add Field" to add some.</p>
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
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                      onClick={handleSave}
                    >
                      Save
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