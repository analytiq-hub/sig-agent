import "@/styles/globals.css";
import React from 'react';
import { getServerSession } from "next-auth/next"
import SessionProvider from "@/components/SessionProvider"
import Layout from '@/components/Layout';
import ThemeRegistry from '@/components/ThemeRegistry';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';

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
  const session = await getServerSession();
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>
          <SessionProvider session={session}>
            <WorkspaceProvider>
              <Layout>{children}</Layout>
            </WorkspaceProvider>
          </SessionProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
