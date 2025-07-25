'use client';

import { useEffect } from 'react';
import { Formio, Templates } from "@tsed/react-formio";
import tailwind from "@tsed/tailwind-formio";

export default function FormioProvider({
  children
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    // Initialize Formio with Tailwind (uses Boxicons by default)
    Formio.use(tailwind);
    Templates.framework = "tailwind";
  }, []);

  return <>{children}</>;
} 