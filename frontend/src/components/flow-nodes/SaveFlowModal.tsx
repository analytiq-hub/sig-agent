import React, { useState, useEffect } from 'react';
import { Tag } from '@/types/index';

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
                  type="button"
                  onClick={() => {
                    setSelectedTagIds(prev => 
                      prev.includes(tag.id)
                        ? prev.filter(id => id !== tag.id)
                        : [...prev, tag.id]
                    );
                  }}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors
                    ${selectedTagIds.includes(tag.id)
                      ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                >
                  {tag.name}
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