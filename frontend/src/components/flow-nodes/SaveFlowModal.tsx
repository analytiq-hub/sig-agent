import React, { useState, useEffect } from 'react';
import { Tag } from '@/types/index';
import colors from 'tailwindcss/colors';
import { isColorLight } from '@/utils/colors';

interface SaveFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string, tagIds: string[]) => Promise<void>;
  availableTags: Tag[];
  initialValues?: {
    name: string;
    description?: string;
    tag_ids?: string[];
  };
}

const SaveFlowModal: React.FC<SaveFlowModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave,
  availableTags,
  initialValues 
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialValues) {
        setName(initialValues.name);
        setDescription(initialValues.description || '');
        setSelectedTagIds(initialValues.tag_ids || []);
      } else {
        setName('');
        setDescription('');
        setSelectedTagIds([]);
      }
      setError('');
    }
  }, [isOpen, initialValues]);

  useEffect(() => {
    console.log('Modal effect triggered:', {
      isOpen,
      initialValues,
      currentName: name,
      currentDescription: description,
      currentTags: selectedTagIds
    });
  }, [isOpen, initialValues, name, description, selectedTagIds]);

  const handleSave = async () => {
    console.log('Saving with values:', {
      name,
      description,
      selectedTagIds
    });

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    try {
      await onSave(name, description, selectedTagIds);
      onClose();
    } catch (error) {
      setError((error as Error).message);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('Name changed:', e.target.value);
    setName(e.target.value);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    console.log('Description changed:', e.target.value);
    setDescription(e.target.value);
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-96">
        <h2 className="text-xl font-bold mb-4">
          {initialValues ? 'Update Flow' : 'Save Flow'}
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={handleDescriptionChange}
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
            <div className="flex flex-wrap gap-2">
              {availableTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => {
                    setSelectedTagIds(prev => 
                      prev.includes(tag.id)
                        ? prev.filter(id => id !== tag.id)
                        : [...prev, tag.id]
                    )
                  }}
                  className={`group transition-all ${
                    selectedTagIds.includes(tag.id)
                      ? 'ring-2 ring-blue-500 ring-offset-2'
                      : 'hover:ring-2 hover:ring-gray-300 hover:ring-offset-2'
                  }`}
                >
                  <div className="flex items-center h-full w-full">
                    <div 
                      className={`px-2 py-1 leading-none rounded shadow-sm flex items-center gap-2 text-sm ${
                        isColorLight(tag.color) ? 'text-gray-800' : 'text-white'
                      }`}
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                      {selectedTagIds.includes(tag.id) && (
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {initialValues ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaveFlowModal; 