import React, { useEffect, useRef } from 'react';
import { FormBuilder } from 'formiojs';
import type { FormBuilder as FormioFormBuilder, Form as FormioForm } from 'formiojs';

interface FormioBuilderProps {
  formJson?: FormioForm | object;
  onChange?: (schema: FormioForm | object) => void;
}

const FormioBuilder: React.FC<FormioBuilderProps> = ({ formJson, onChange }) => {
  const builderRef = useRef<HTMLDivElement>(null);
  const builderInstance = useRef<FormioFormBuilder | null>(null);

  useEffect(() => {
    if (!builderRef.current) return;

    // Clean up previous builder if any
    if (builderInstance.current) {
      builderInstance.current.destroy();
      builderInstance.current = null;
    }

    // Create the Formio builder
    const builder = new FormBuilder(builderRef.current, formJson || {}, {});
    builderInstance.current = builder;
    builder.on('change', () => {
      if (onChange) {
        onChange(builder.form);
      }
    }, false);

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
