import { useState, useEffect } from 'react'
import { BoltIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

interface DocumentBulkUpdateMetadataProps {
  totalDocuments: number
  onDataChange: (data: any) => void
  disabled?: boolean
  selectedOperation?: string
}

export function DocumentBulkUpdateMetadata({
  totalDocuments,
  onDataChange,
  disabled = false,
  selectedOperation = 'addMetadata'
}: DocumentBulkUpdateMetadataProps) {
  const [metadataFields, setMetadataFields] = useState<Array<{id: string, key: string, value: string}>>([])
  const [metadataKeysToRemove, setMetadataKeysToRemove] = useState<string>('')

  const updateData = () => {
    let data: any = null

    switch (selectedOperation) {
      case 'addMetadata':
        const validFields = metadataFields.filter(field => field.key.trim() !== '' && field.value.trim() !== '')
        if (validFields.length > 0) {
          // Check for duplicate keys
          const keys = validFields.map(field => field.key.trim())
          const duplicateKeys = keys.filter((key, index) => keys.indexOf(key) !== index)
          if (duplicateKeys.length > 0) {
            alert(`Duplicate keys found: ${duplicateKeys.join(', ')}. Please remove or rename duplicate keys.`)
            return
          }
          data = validFields.reduce((acc, field) => {
            acc[field.key.trim()] = field.value.trim()
            return acc
          }, {} as Record<string, string>)
        }
        break
      case 'removeMetadata':
        const keysToRemove = metadataKeysToRemove
          .split(',')
          .map(key => key.trim())
          .filter(key => key !== '')
        if (keysToRemove.length > 0) {
          data = keysToRemove
        }
        break
      case 'clearMetadata':
        data = null // Clear all metadata
        break
    }

    onDataChange(data)
  }

  const handleAddMetadataField = () => {
    const newId = `field_${Date.now()}`
    setMetadataFields(prev => {
      const newFields = [...prev, { id: newId, key: '', value: '' }]
      setTimeout(() => updateData(), 0) // Update data after state change
      return newFields
    })
  }

  const handleRemoveMetadataField = (id: string) => {
    setMetadataFields(prev => {
      const newFields = prev.filter(field => field.id !== id)
      setTimeout(() => updateData(), 0) // Update data after state change
      return newFields
    })
  }

  const handleMetadataKeyChange = (id: string, newKey: string) => {
    setMetadataFields(prev => {
      const newFields = prev.map(field =>
        field.id === id ? { ...field, key: newKey } : field
      )
      setTimeout(() => updateData(), 0) // Update data after state change
      return newFields
    })
  }

  const handleMetadataValueChange = (id: string, newValue: string) => {
    setMetadataFields(prev => {
      const newFields = prev.map(field =>
        field.id === id ? { ...field, value: newValue } : field
      )
      setTimeout(() => updateData(), 0) // Update data after state change
      return newFields
    })
  }

  const handleKeysToRemoveChange = (value: string) => {
    setMetadataKeysToRemove(value)
    setTimeout(() => updateData(), 0) // Update data after state change
  }

  // Update data when operation changes
  useEffect(() => {
    updateData()
  }, [selectedOperation])

  return (
    <div>
      {/* Dynamic Content Area */}
      {selectedOperation === 'addMetadata' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-600">Configure metadata fields to add:</span>
            <button
              type="button"
              onClick={handleAddMetadataField}
              disabled={disabled || totalDocuments === 0}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-500 disabled:text-gray-400"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Field
            </button>
          </div>

            <div className="space-y-2">
              {metadataFields.map((field) => (
                <div key={field.id} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Key"
                    value={field.key}
                    onChange={(e) => handleMetadataKeyChange(field.id, e.target.value)}
                    disabled={disabled || totalDocuments === 0}
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:bg-gray-100"
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={field.value}
                    onChange={(e) => handleMetadataValueChange(field.id, e.target.value)}
                    disabled={disabled || totalDocuments === 0}
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:bg-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveMetadataField(field.id)}
                    disabled={disabled || totalDocuments === 0}
                    className="text-red-500 hover:text-red-700 disabled:text-gray-400"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {metadataFields.length === 0 && (
                <p className="text-sm text-gray-500 italic">No metadata fields. Click "Add Field" to add some.</p>
              )}
            </div>
          </div>
        )}

      {selectedOperation === 'removeMetadata' && (
        <div>
          <span className="text-sm text-gray-600 mb-2 block">
            Metadata keys to remove (comma-separated):
          </span>
            <input
              type="text"
              placeholder="author,type,category"
              value={metadataKeysToRemove}
              onChange={(e) => handleKeysToRemoveChange(e.target.value)}
              disabled={disabled || totalDocuments === 0}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:bg-gray-100"
            />
          <p className="text-xs text-gray-500 mt-1">
            Enter the metadata field names you want to remove, separated by commas.
          </p>
        </div>
      )}

      {selectedOperation === 'clearMetadata' && (
        <div>
          <p className="text-sm text-gray-700">
            This will remove <strong>all metadata</strong> from the selected documents.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Warning: This action cannot be undone. All custom metadata fields will be permanently removed.
          </p>
        </div>
      )}
    </div>
  )
}