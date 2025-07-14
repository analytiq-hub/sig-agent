import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { isColorLight } from '@/utils/colors'
import { Tag } from '@/types/index';
import TagSelector from './TagSelector';

interface DocumentUpdateProps {
  isOpen: boolean
  onClose: () => void
  documentName: string
  currentTags: string[]
  availableTags: Tag[]
  onSave: (tagIds: string[]) => Promise<void>
}

export function DocumentUpdate({ 
  isOpen, 
  onClose, 
  documentName, 
  currentTags, 
  availableTags,
  onSave 
}: DocumentUpdateProps) {
  const [selectedTags, setSelectedTags] = useState(currentTags)

  const handleSave = async () => {
    await onSave(selectedTags);
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
                  <div className="flex-1 overflow-y-auto px-4 sm:px-6">
                    {/* TagSelector replaces manual tag buttons */}
                    <TagSelector
                      availableTags={availableTags}
                      selectedTagIds={selectedTags}
                      onChange={setSelectedTags}
                    />
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