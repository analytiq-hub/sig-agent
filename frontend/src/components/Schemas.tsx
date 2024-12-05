import React, { useState, useEffect } from 'react';
import { SchemaField, Schema, createSchemaApi, getSchemasApi, deleteSchemaApi, updateSchemaApi } from '@/utils/api';
import { isAxiosError, getApiErrorMsg } from '@/utils/api';

const Schemas = () => {
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [currentSchema, setCurrentSchema] = useState<{id?: string; name: string; fields: SchemaField[]}>(
    { name: '', fields: [{ name: '', type: 'str' }] }
  );
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const saveSchema = async (schema: {name: string; fields: SchemaField[]}) => {
    try {
      setIsLoading(true);
      let savedSchema: Schema;
      
      if (currentSchema.id) {
        // Update existing schema
        savedSchema = await updateSchemaApi(currentSchema.id, schema);
        setSchemas(schemas.map(s => s.id === savedSchema.id ? savedSchema : s));
        setMessage('Schema updated successfully');
      } else {
        // Check for duplicate name when creating new schema
        const isDuplicateName = schemas.some(
          existingSchema => existingSchema.name.toLowerCase() === schema.name.toLowerCase()
        );
        
        if (isDuplicateName) {
          setMessage('Error: A schema with this name already exists');
          return;
        }
        
        // Create new schema
        savedSchema = await createSchemaApi(schema);
        setSchemas([...schemas, savedSchema]);
        setMessage('Schema created successfully');
      }
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error saving schema';
      setMessage('Error: ' + errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSchemas = async () => {
    try {
      setIsLoading(true);
      const response = await getSchemasApi();
      setSchemas(response.schemas);
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error loading schemas';
      setMessage('Error: ' + errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (schemaId: string) => {
    try {
      setIsLoading(true);
      await deleteSchemaApi(schemaId);
      setSchemas(schemas.filter(schema => schema.id !== schemaId));
      setMessage('Schema deleted successfully');
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error deleting schema';
      setMessage('Error: ' + errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSchemas();
  }, []);

  const addField = () => {
    setCurrentSchema({
      ...currentSchema,
      fields: [...currentSchema.fields, { name: '', type: 'str' }]
    });
  };

  const removeField = (index: number) => {
    const newFields = currentSchema.fields.filter((_, i) => i !== index);
    setCurrentSchema({ ...currentSchema, fields: newFields });
  };

  const updateField = (index: number, field: Partial<SchemaField>) => {
    const newFields = currentSchema.fields.map((f, i) => 
      i === index ? { ...f, ...field } : f
    );
    setCurrentSchema({ ...currentSchema, fields: newFields });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSchema.name || currentSchema.fields.some(f => !f.name)) {
      setMessage('Please fill in all fields');
      return;
    }
    saveSchema(currentSchema);
    setCurrentSchema({ name: '', fields: [{ name: '', type: 'str' }] });
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Schema Creation Form */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-bold mb-4">Create Pydantic Schema</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Schema Name</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={currentSchema.name}
              onChange={e => setCurrentSchema({ ...currentSchema, name: e.target.value })}
              placeholder="SchemaName"
              disabled={isLoading}
            />
          </div>

          {/* Fields */}
          <div className="space-y-3">
            {currentSchema.fields.map((field, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 p-2 border rounded"
                  value={field.name}
                  onChange={e => updateField(index, { name: e.target.value })}
                  placeholder="field_name"
                  disabled={isLoading}
                />
                <select
                  className="p-2 border rounded"
                  value={field.type}
                  onChange={e => updateField(index, { type: e.target.value as SchemaField['type'] })}
                  disabled={isLoading}
                >
                  <option value="str">String</option>
                  <option value="int">Integer</option>
                  <option value="float">Float</option>
                  <option value="bool">Boolean</option>
                  <option value="datetime">DateTime</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeField(index)}
                  className="px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50"
                  disabled={isLoading}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={addField}
              className="px-4 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 disabled:opacity-50"
              disabled={isLoading}
            >
              Add Field
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={isLoading}
            >
              Save Schema
            </button>
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

      {/* Schemas List */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Saved Schemas</h2>
        <div className="space-y-4">
          {schemas.map((schema) => (
            <div key={schema.id} className="p-4 border rounded hover:bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium">{schema.name}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCurrentSchema({
                        id: schema.id,
                        name: schema.name,
                        fields: schema.fields
                      });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="px-3 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 disabled:opacity-50"
                    disabled={isLoading}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(schema.id)}
                    className="px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50"
                    disabled={isLoading}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                {schema.fields.map((field, i) => (
                  <div key={i}>
                    {field.name}: {field.type}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Schemas;