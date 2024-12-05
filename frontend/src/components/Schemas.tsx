import React, { useState } from 'react';

type FieldType = 'str' | 'int' | 'float' | 'bool' | 'datetime';

interface SchemaField {
  name: string;
  type: FieldType;
}

interface Schema {
  name: string;
  fields: SchemaField[];
}

const Schemas = () => {
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [currentSchema, setCurrentSchema] = useState<Schema>({ 
    name: '', 
    fields: [{ name: '', type: 'str' }] 
  });
  const [message, setMessage] = useState('');

  const saveSchema = async (schema: Schema) => {
    try {
      // Replace with actual API call
      console.log('Saving schema:', schema);
      setSchemas([...schemas, schema]);
      setMessage('Schema saved successfully');
    } catch (error) {
      setMessage('Error saving schema');
    }
  };

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
                />
                <select
                  className="p-2 border rounded"
                  value={field.type}
                  onChange={e => updateField(index, { type: e.target.value as FieldType })}
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
                  className="px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100"
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
              className="px-4 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
            >
              Add Field
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save Schema
            </button>
          </div>
        </form>

        {/* Message */}
        {message && (
          <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded">
            {message}
          </div>
        )}
      </div>

      {/* Schemas List */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Saved Schemas</h2>
        <div className="space-y-4">
          {schemas.map((schema, index) => (
            <div key={index} className="p-4 border rounded hover:bg-gray-50">
              <h3 className="font-medium mb-2">{schema.name}</h3>
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