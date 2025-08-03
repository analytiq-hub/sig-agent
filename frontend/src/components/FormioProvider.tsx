'use client';

import { useEffect } from 'react';
import { useAppSession } from '@/contexts/AppSessionContext';

// Global type declarations for the proxy helper
declare global {
  interface Window {
    FASTAPI_URL: string;
    proxyFetch: (url: string, options?: RequestInit) => Promise<Response>;
  }
}

export default function FormioProvider({
  children
}: {
  children: React.ReactNode
}) {
  const { session } = useAppSession();
  useEffect(() => {
    // Only initialize Formio on the client side
    const initializeFormio = async () => {
      const { Formio, Templates } = await import("@tsed/react-formio");
      const tailwind = await import("@tsed/tailwind-formio");
      
      // Initialize Formio with Tailwind (uses Boxicons by default)
      Formio.use(tailwind.default);
      Templates.framework = "tailwind";
    };

    // Initialize global helpers for FormIO calculated values
    const initializeGlobalHelpers = () => {
      // Make FASTAPI URL available globally for FormIO
      window.FASTAPI_URL = process.env.NEXT_PUBLIC_FASTAPI_FRONTEND_URL || "http://localhost:8000";
      
      // Generic proxy fetch function
      window.proxyFetch = async (url: string, options: RequestInit = {}) => {
        if (!session?.apiAccessToken) {
          throw new Error('No authentication token available');
        }

        const proxyUrl = `${window.FASTAPI_URL}/v0/proxy?url=${encodeURIComponent(url)}`;
        
        return fetch(proxyUrl, {
          ...options,
          headers: {
            'Authorization': `Bearer ${session.apiAccessToken}`,
            'Content-Type': 'application/json',
            ...options.headers
          }
        });
      };
    };

    initializeFormio();
    initializeGlobalHelpers();
  }, [session]);

  return <>{children}</>;
} 