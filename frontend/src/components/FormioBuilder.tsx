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
  const isUpdatingFromProps = useRef(false);
  const changeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep the onChange ref updated
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    // Ensure we're using the Tailwind template
    Templates.framework = 'tailwind';

    if (!builderRef.current) return;

    // Normalize jsonFormio for comparison (handle undefined/null)
    const currentJsonFormio = jsonFormio || '';
    
    // Only recreate if jsonFormio actually changed significantly
    // This prevents recreation during tab switches and minor UI changes
    if (currentJsonFormio === lastJsonFormio.current) return;
    
    // Also check if it's just a formatting difference (same components, different whitespace)
    try {
      const currentParsed = currentJsonFormio ? JSON.parse(currentJsonFormio) : [];
      const lastParsed = lastJsonFormio.current ? JSON.parse(lastJsonFormio.current) : [];
      
      if (JSON.stringify(currentParsed) === JSON.stringify(lastParsed)) {
        return; // Same components, don't recreate
      }
    } catch (e) {
      // If parsing fails, continue with normal flow
      console.error('Error parsing jsonFormio:', e);
    }
    
    lastJsonFormio.current = currentJsonFormio;

    // Destroy existing builder if it exists
    if (builderInstance.current) {
      builderInstance.current.destroy();
      builderInstance.current = null;
    }

    isInitializing.current = true;
    isUpdatingFromProps.current = true;

    // Parse the form data
    let form = {};
    if (currentJsonFormio.trim() !== '') {
      try {
        const parsedComponents = JSON.parse(currentJsonFormio);
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleFormChange = (event: unknown) => {
      // Don't trigger onChange if we're updating from props to prevent loops
      if (onChangeRef.current && !isInitializing.current && !isUpdatingFromProps.current) {
        const currentForm: FormWithComponents = (builder as FormBuilder & { _form: FormWithComponents })._form;
        const currentComponents = JSON.stringify(currentForm.components);
        
        // Only call onChange if the components actually changed from what we have
        if (currentComponents !== lastJsonFormio.current) {
          // Clear any existing timeout
          if (changeTimeoutRef.current) {
            clearTimeout(changeTimeoutRef.current);
          }
          
          // Debounce the onChange call to prevent rapid rebuilds during UI interactions
          changeTimeoutRef.current = setTimeout(() => {
            if (onChangeRef.current && currentComponents !== lastJsonFormio.current) {
              lastJsonFormio.current = currentComponents;
              onChangeRef.current(currentForm.components);
            }
          }, 300); // Longer delay to allow tab switching to complete
        }
      }
    };

    // Listen via the events emitter directly
    if (builder.events) {
      (builder.events as { on: (event: string, handler: (event?: unknown) => void) => void }).on('formio.change', handleFormChange);
    }

    // Trigger initial change after builder is ready to sync the actual form structure
    setTimeout(() => {
      isInitializing.current = false;
      isUpdatingFromProps.current = false;
    }, 100);

    // Cleanup on unmount
    return () => {
      if (changeTimeoutRef.current) {
        clearTimeout(changeTimeoutRef.current);
        changeTimeoutRef.current = null;
      }
      if (builderInstance.current) {
        builderInstance.current.destroy();
        builderInstance.current = null;
      }
    };
  }, [jsonFormio]);

  return <div ref={builderRef} />;
};

export default FormioBuilder;
