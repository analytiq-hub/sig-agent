import React, { useEffect, useRef } from 'react';
import { Templates } from '@tsed/react-formio';
import { FormBuilder } from 'formiojs';
import type { Form } from 'formiojs';

interface FormioBuilderProps {
  formJson?: Form | object;
  onChange?: (schema: Form | object) => void;
}

const FormioBuilder: React.FC<FormioBuilderProps> = ({ formJson, onChange }) => {
  const builderRef = useRef<HTMLDivElement>(null);
  const builderInstance = useRef<FormBuilder | null>(null);

  useEffect(() => {
    // Ensure we're using the Tailwind template
    Templates.framework = 'tailwind';

    if (!builderRef.current) return;

    // Clean up previous builder if any
    if (builderInstance.current) {
      builderInstance.current.destroy();
      builderInstance.current = null;
    }

    // Create the Formio builder (iconClass configured globally in FormioProvider)
    const builder = new FormBuilder(builderRef.current, formJson || {}, {});
    
    builderInstance.current = builder;
    
    // Listen to the correct FormBuilder events
    const handleFormChange = () => {
      if (onChange) {
        const currentForm = builder.form;
        onChange(currentForm);
      }
    };

    // Listen via the events emitter directly
    if (builder.events) {
      (builder.events as { on: (event: string, handler: () => void) => void }).on('formio.change', handleFormChange);
    }

    // Cleanup on unmount
    return () => {
      if (builderInstance.current) {
        builderInstance.current.destroy();
        builderInstance.current = null;
      }
    };
  }, [formJson, onChange]);

  return <div ref={builderRef} />;
};

export default FormioBuilder;
