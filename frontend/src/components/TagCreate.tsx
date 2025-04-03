"use client";

import React, { useState, useEffect } from 'react';
import { createTagApi, updateTagApi, getApiErrorMsg } from '@/utils/api';
import { TagConfig } from '@/types/index';
import colors from 'tailwindcss/colors';
import InfoTooltip from '@/components/InfoTooltip';
import { useTagContext } from '@/contexts/TagContext';

const TagCreate: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const { editingTag, setEditingTag } = useTagContext();
  const [currentTag, setCurrentTag] = useState<{id?: string; name: string; color: string; description: string}>({
    name: '',
    color: colors.blue[500], // default blue color
    description: ''
  });
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load editing tag if available
  useEffect(() => {
    if (editingTag) {
      setCurrentTag({
        id: editingTag.id,
        name: editingTag.name,
        color: editingTag.color || colors.blue[500],
        description: editingTag.description || ''
      });
      
      // Clear the editing tag after loading
      setEditingTag(null);
    }
  }, [editingTag, setEditingTag]);

  const saveTag = async (tag: TagConfig) => {
    try {
      setIsLoading(true);
      
      if (currentTag.id) {
        // Update existing tag
        await updateTagApi({
          organizationId: organizationId,
          tagId: currentTag.id,
          tag: {
            name: tag.name,
            color: tag.color,
            description: tag.description
          }
        });
        setMessage('Tag updated successfully');
      } else {
        // Create new tag
        await createTagApi({
          organizationId: organizationId,
          tag: tag
        });
        setMessage('Tag created successfully');
      }
      
      // Reset form only after successful save
      setCurrentTag({ name: '', color: colors.blue[500], description: '' });
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error saving tag';
      setMessage('Error: ' + errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTag.name) {
      setMessage('Please fill in the tag name');
      return;
    }

    saveTag(currentTag);
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="flex items-center gap-2 mb-4 hidden md:block">
          <h2 className="text-xl font-bold">
            {currentTag.id ? 'Edit Tag' : 'Create Tag'}
          </h2>
          <InfoTooltip 
            title="About Tags"
            content={
              <>
                <p className="mb-2">
                  Tags can be assigned to documents and prompts.
                </p>
                <ul className="list-disc list-inside space-y-1 mb-2">
                  <li>Create tags for different types of documents, or different types of data you want to extract.</li>
                  <li>Assign tags to prompts to control which documents they process.</li>
                  <li>Assign tags when uploading documents.</li>
                </ul>
              </>
            }
          />
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-1 min-w-[300px] gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  className="w-full p-2 border rounded disabled:bg-gray-100"
                  value={currentTag.name}
                  onChange={e => setCurrentTag({ ...currentTag, name: e.target.value })}
                  placeholder="Tag Name"
                  disabled={isLoading}
                />
              </div>
              <div className="w-20">
                <input
                  type="color"
                  className="w-full h-10 p-1 border rounded cursor-pointer"
                  value={currentTag.color}
                  onChange={e => setCurrentTag({ ...currentTag, color: e.target.value })}
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={() => {
                  setCurrentTag({ name: '', color: colors.blue[500], description: '' });
                  setMessage('');
                  setEditingTag(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                disabled={isLoading}
              >
                Clear
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={isLoading}
              >
                {currentTag.id ? 'Update Tag' : 'Save Tag'}
              </button>
            </div>
          </div>

          <div>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={currentTag.description}
              onChange={e => setCurrentTag({ ...currentTag, description: e.target.value })}
              placeholder="Description (optional)"
              disabled={isLoading}
            />
          </div>
        </form>

        {/* Message */}
        {message && (
          <div className={`mt-4 p-3 rounded ${
            message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
          }`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagCreate; 