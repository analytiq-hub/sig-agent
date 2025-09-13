import { useState } from 'react'
import { BoltIcon } from '@heroicons/react/24/outline'
import { Tag } from '@/types/index';
import TagSelector from './TagSelector';

interface DocumentBulkUpdateTagsProps {
  availableTags: Tag[]
  totalDocuments: number
  onDataChange: (data: string[]) => void
  disabled?: boolean
  selectedOperation?: string
}

export function DocumentBulkUpdateTags({
  availableTags,
  totalDocuments,
  onDataChange,
  disabled = false,
  selectedOperation = 'addTags'
}: DocumentBulkUpdateTagsProps) {
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

  const handleTagChange = (tagIds: string[]) => {
    setSelectedTagIds(tagIds)
    onDataChange(tagIds)
  }

  const resetState = () => {
    setSelectedTagIds([])
    onDataChange([])
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {selectedOperation === 'addTags' ? 'Select tags to add:' : 'Select tags to remove:'}
      </label>
      <TagSelector
        availableTags={availableTags}
        selectedTagIds={selectedTagIds}
        onChange={handleTagChange}
        disabled={disabled || totalDocuments === 0}
      />
    </div>
  )
}