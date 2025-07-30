import React, { useEffect, useRef } from 'react';
import { Templates } from '@tsed/react-formio';
import { Form } from 'formiojs';

interface FormioRendererProps {
  jsonFormio?: string;
  onSubmit?: (submission: unknown) => void;
  readOnly?: boolean;
  initialData?: Record<string, unknown>; // Add this prop
}

const FormioRenderer: React.FC<FormioRendererProps> = ({ 
  jsonFormio, 
  onSubmit, 
  readOnly = false,
  initialData 
}) => {
  const formRef = useRef<HTMLDivElement>(null);
  const formInstance = useRef<Form | null>(null);

  useEffect(() => {
    // Ensure we're using the Tailwind template
    Templates.framework = 'tailwind';

    if (!formRef.current) return;

    // Destroy existing form if it exists
    if (formInstance.current) {
      formInstance.current.destroy();
      formInstance.current = null;
    }

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

    // Create the Formio form
    const formioForm = new Form(formRef.current, form, {
      readOnly: readOnly,
      noAlerts: true,
      noValidate: false,
      disableAlerts: true,
      hooks: {
        beforeSubmit: (submission: unknown, next: (submission?: unknown) => void) => {
          if (onSubmit) {
            onSubmit(submission);
          }
          next();
        }
      }
    });
    
    formInstance.current = formioForm;

    // Set initial data if provided
    if (initialData && formInstance.current) {
      // Wait for form to be ready, then set the data
      setTimeout(() => {
        if (formInstance.current) {
          // Access the instance property which has the submission property
          (formInstance.current as unknown as { instance: { submission: Record<string, unknown> } }).instance.submission = initialData;
        }
      }, 100);
    }

    // Cleanup on unmount
    return () => {
      if (formInstance.current) {
        formInstance.current.destroy();
        formInstance.current = null;
      }
    };
  }, [jsonFormio, onSubmit, readOnly, initialData]);

  return <div ref={formRef} />;
};

export default FormioRenderer; 