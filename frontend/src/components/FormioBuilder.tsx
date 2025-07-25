import React, { useEffect, useRef } from 'react';
import { FormBuilder } from 'formiojs';
import type { FormBuilder as FormioFormBuilder, Form as FormioForm } from 'formiojs';
import '@/styles/formio-custom.css';

interface FormioBuilderProps {
  formJson?: FormioForm | object;
  onChange?: (schema: FormioForm | object) => void;
}

const BOOTSTRAP_CDN = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css";

const FormioBuilder: React.FC<FormioBuilderProps> = ({ formJson, onChange }) => {
  const builderRef = useRef<HTMLDivElement>(null);
  const builderInstance = useRef<FormioFormBuilder | null>(null);

  useEffect(() => {
    // Dynamically inject Bootstrap CSS
    let bootstrapLink: HTMLLinkElement | null = null;
    if (!document.getElementById('formio-bootstrap-css')) {
      bootstrapLink = document.createElement('link');
      bootstrapLink.rel = 'stylesheet';
      bootstrapLink.href = BOOTSTRAP_CDN;
      bootstrapLink.id = 'formio-bootstrap-css';
      document.head.appendChild(bootstrapLink);
    }

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
      // Optionally remove the Bootstrap CSS if you want to clean up after unmount
      // if (bootstrapLink) document.head.removeChild(bootstrapLink);
    };
  }, [formJson, onChange]);

  return <div ref={builderRef} />;
};

export default FormioBuilder;
