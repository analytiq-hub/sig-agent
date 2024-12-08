import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { isColorLight } from '@/utils/colors'
import { Tag } from '@/utils/api'

interface DocumentTagEditorProps {
  isOpen: boolean
  onClose: () => void
  documentName: string
  currentTags: string[]
  availableTags: Tag[]
  onSave: (tagIds: string[]) => Promise<void>
}

export function DocumentTagEditor({ 
  isOpen, 
  onClose, 
  documentName, 
  currentTags, 
  availableTags,
  onSave 
}: DocumentTagEditorProps) {
  const [selectedTags, setSelectedTags] = useState(currentTags)

  const handleSave = async () => {
    console.log('DocumentTagEditor - Saving tags:', {
      documentName,
      selectedTags,
      currentTags
    });
    await onSave(selectedTags);
    onClose();
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                <div className="flex h-full flex-col bg-white shadow-xl">
                  <div className="px-4 py-6 sm:px-6">
                    <div className="flex items-start justify-between">
                      <h2 className="text-base font-semibold leading-6 text-gray-900">
                        Edit Tags: {documentName}
                      </h2>
                      <button
                        type="button"
                        className="rounded-md text-gray-400 hover:text-gray-500"
                        onClick={onClose}
                      >
                        <XMarkIcon className="h-6 w-6" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 sm:px-6">
                    <div className="grid grid-cols-2 gap-2">
                      {availableTags.map(tag => (
                        <button
                          key={tag.id}
                          onClick={() => {
                            setSelectedTags(prev => 
                              prev.includes(tag.id)
                                ? prev.filter(id => id !== tag.id)
                                : [...prev, tag.id]
                            )
                          }}
                          className={`p-3 rounded-lg border-2 text-left ${
                            selectedTags.includes(tag.id)
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`px-2 py-1 leading-none rounded shadow-sm ${
                                isColorLight(tag.color) ? 'text-gray-800' : 'text-white'
                              }`}
                              style={{ backgroundColor: tag.color }}
                            >
                              {tag.name}
                            </div>
                          </div>
                        </button>
                      ))}
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
              </Dialog.Panel>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
} 