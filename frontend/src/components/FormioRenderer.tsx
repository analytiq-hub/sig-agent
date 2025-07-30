import React, { useEffect, useRef } from 'react';
import { Templates } from '@tsed/react-formio';
import { Form } from 'formiojs';

interface FormioRendererProps {
  jsonFormio?: string;
  onSubmit?: (submission: unknown) => void;
  readOnly?: boolean;
}

const FormioRenderer: React.FC<FormioRendererProps> = ({ jsonFormio, onSubmit, readOnly = false }) => {
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
        beforeSubmit: (submission: unknown, next: unknown) => {
          if (onSubmit) {
            onSubmit(submission);
          }
          next();
        }
      }
    });
    
    formInstance.current = formioForm;

    // Cleanup on unmount
    return () => {
      if (formInstance.current) {
        formInstance.current.destroy();
        formInstance.current = null;
      }
    };
  }, [jsonFormio, onSubmit, readOnly]);

  return <div ref={formRef} />;
};

export default FormioRenderer; 