import "@/styles/globals.css";
import React from 'react';
import SessionProvider from "@/components/SessionProvider"
import Layout from '@/components/Layout';
import ThemeRegistry from '@/components/ThemeRegistry';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { getAppServerSession } from '@/utils/session';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'Smart Document Router',
  description: 'Smart Document Router',
  icons: {
    icon: '/favicon.ico',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const appSession = await getAppServerSession();
  return (
    <html lang="en">
      <body>
        <Toaster position="top-right" />
        <ThemeRegistry>
          <SessionProvider session={appSession}>
            <OrganizationProvider>
              <Layout>{children}</Layout>
            </OrganizationProvider>
          </SessionProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
