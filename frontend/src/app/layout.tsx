import React from 'react';
import Layout from '@/components/Layout';
import { getServerSession } from "next-auth/next"
import SessionProvider from "@/components/SessionProvider"

export const metadata = {
  title: 'Doc Proxy',
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
      <SessionProvider session={session}>
          <Layout>{children}</Layout>
        </SessionProvider>
      </body>
    </html>
  );
}
