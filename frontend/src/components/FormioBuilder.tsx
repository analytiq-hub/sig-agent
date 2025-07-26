import React, { useEffect, useRef } from 'react';
import { Templates } from '@tsed/react-formio';
import { FormBuilder } from 'formiojs';
import type { Form } from 'formiojs';

interface FormioBuilderProps {
  jsonFormio?: string;
  onChange?: (schema: Form | object) => void;
}

interface FormWithComponents extends Form {
  components: unknown[];
}

const FormioBuilder: React.FC<FormioBuilderProps> = ({ jsonFormio, onChange }) => {
  const builderRef = useRef<HTMLDivElement>(null);
  const builderInstance = useRef<FormBuilder | null>(null);
  const onChangeRef = useRef(onChange);
  const isInitializing = useRef(false);
  const lastJsonFormio = useRef<string>('');

  // Keep the onChange ref updated
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    // Ensure we're using the Tailwind template
    Templates.framework = 'tailwind';

    if (!builderRef.current) return;

    // Only recreate if jsonFormio actually changed and it's not empty
    if (jsonFormio === lastJsonFormio.current) return;
    
    lastJsonFormio.current = jsonFormio || '';

    // Destroy existing builder if it exists
    if (builderInstance.current) {
      builderInstance.current.destroy();
      builderInstance.current = null;
    }

    isInitializing.current = true;

    // Parse the form data
    let form = {};
    if (jsonFormio && jsonFormio.trim() !== '') {
      try {
        const parsedComponents = JSON.parse(jsonFormio);
        form = { components: parsedComponents };
      } catch (error) {
        console.error('Error parsing jsonFormio:', error);
        form = { components: [] };
      }
    }

    // Create the Formio builder
    const builder = new FormBuilder(builderRef.current, form, {});
    builderInstance.current = builder;
    
    // Listen to the correct FormBuilder events
    const handleFormChange = () => {
      if (onChangeRef.current && !isInitializing.current) {
        const currentForm: FormWithComponents = (builder as FormBuilder & { _form: FormWithComponents })._form;
        onChangeRef.current(currentForm.components);
      }
    };

    // Listen via the events emitter directly
    if (builder.events) {
      (builder.events as { on: (event: string, handler: () => void) => void }).on('formio.change', handleFormChange);
    }

    // Set initialization to false after a short delay
    setTimeout(() => {
      isInitializing.current = false;
    }, 100);

    // Cleanup on unmount
    return () => {
      if (builderInstance.current) {
        builderInstance.current.destroy();
        builderInstance.current = null;
      }
    };
  }, [jsonFormio]); // Keep jsonFormio as dependency

  return <div ref={builderRef} />;
};

export default FormioBuilder;
