import React, { useEffect, useRef } from 'react';
import { Templates } from '@tsed/react-formio';
import { FormBuilder } from 'formiojs';
import type { Form } from 'formiojs';

interface FormioBuilderProps {
  formJson?: Form | object;
  onChange?: (schema: Form | object) => void;
}

interface FormWithComponents extends Form {
  components: unknown[];
}

const FormioBuilder: React.FC<FormioBuilderProps> = ({ formJson, onChange }) => {
  const builderRef = useRef<HTMLDivElement>(null);
  const builderInstance = useRef<FormBuilder | null>(null);
  const onChangeRef = useRef(onChange);

  // Keep the onChange ref updated
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    // Ensure we're using the Tailwind template
    Templates.framework = 'tailwind';

    if (!builderRef.current) return;

    // Only create the builder once
    if (!builderInstance.current) {
      // Create the Formio builder (iconClass configured globally in FormioProvider)
      const builder = new FormBuilder(builderRef.current, formJson || {}, {});
      
      builderInstance.current = builder;
      
      // Listen to the correct FormBuilder events
      const handleFormChange = () => {
        if (onChangeRef.current) {
          const currentForm: FormWithComponents = (builder as FormBuilder & { _form: FormWithComponents })._form;
          //console.log('FormioBuilder components', currentForm.components);
          onChangeRef.current(currentForm.components);
        }
      };

      // Listen via the events emitter directly
      if (builder.events) {
        (builder.events as { on: (event: string, handler: () => void) => void }).on('formio.change', handleFormChange);
      }
    }

    // Cleanup on unmount
    return () => {
      if (builderInstance.current) {
        builderInstance.current.destroy();
        builderInstance.current = null;
      }
    };
  }, []); // Empty dependency array - only run once

  return <div ref={builderRef} />;
};

export default FormioBuilder;
