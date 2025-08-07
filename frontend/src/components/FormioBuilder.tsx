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
  const isTabSwitching = useRef(false);
  const changeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleBuilderClickRef = useRef<((event: Event) => void) | null>(null);

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
    
    // Only recreate if jsonFormio actually changed
    if (currentJsonFormio === lastJsonFormio.current) return;
    
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
    const handleFormChange = () => {
      // Don't trigger onChange if we're updating from props to prevent loops
      if (onChangeRef.current && !isInitializing.current && !isUpdatingFromProps.current && !isTabSwitching.current) {
        // Clear any existing timeout
        if (changeTimeoutRef.current) {
          clearTimeout(changeTimeoutRef.current);
        }

        // Debounce the change to prevent rapid updates during tab switching
        changeTimeoutRef.current = setTimeout(() => {
          const currentForm: FormWithComponents = (builder as FormBuilder & { _form: FormWithComponents })._form;
          const currentComponents = JSON.stringify(currentForm.components);
          
          // Only call onChange if the components actually changed from what we have
          if (currentComponents !== lastJsonFormio.current && onChangeRef.current) {
            onChangeRef.current(currentForm.components);
          }
        }, 100);
      }
    };

    // Listen via the events emitter directly
    if (builder.events) {
      (builder.events as { on: (event: string, handler: () => void) => void }).on('formio.change', handleFormChange);
      // Also listen for component selection changes which can trigger during tab switching
      (builder.events as { on: (event: string, handler: () => void) => void }).on('componentChange', handleFormChange);
    }

    // Set up tab switching detection
    const handleTabClick = () => {
      isTabSwitching.current = true;
      // Reset the flag after a short delay
      setTimeout(() => {
        isTabSwitching.current = false;
      }, 500);
    };

    // Listen for tab clicks in the builder
    if (builderRef.current) {
      const tabElements = builderRef.current.querySelectorAll('.nav-link, .nav-item a, [role="tab"]');
      tabElements.forEach(tab => {
        tab.addEventListener('click', handleTabClick);
      });
      
      // Also listen for any clicks within the builder area that might be tab-related
      handleBuilderClickRef.current = (event: Event) => {
        const target = event.target as HTMLElement;
        if (target.closest('.nav-link, .nav-item a, [role="tab"]')) {
          handleTabClick();
        }
      };
      
      builderRef.current.addEventListener('click', handleBuilderClickRef.current);
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
      }
      
      // Remove event listeners
      if (builderRef.current) {
        const tabElements = builderRef.current.querySelectorAll('.nav-link, .nav-item a, [role="tab"]');
        tabElements.forEach(tab => {
          tab.removeEventListener('click', handleTabClick);
        });
        if (handleBuilderClickRef.current) {
          builderRef.current.removeEventListener('click', handleBuilderClickRef.current);
        }
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
