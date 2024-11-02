import axios from 'axios';
import NextAuth, { NextAuthOptions } from "next-auth"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import client from "@/utils/mongodb"

import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { JWT } from "next-auth/jwt";
import { Account, Profile } from "next-auth";
import { AppSession } from '@/app/types/AppSession';

const authOptions: NextAuthOptions = {
    session: {
        strategy: 'jwt' as const,
    },
    adapter: MongoDBAdapter(client),
    secret: process.env.NEXTAUTH_SECRET ?? "", // Needed else we get JWT Google error
    providers: [
      GithubProvider({
        clientId: process.env.AUTH_GITHUB_ID ?? "", // ?? only considers null or undefined as false
        clientSecret: process.env.AUTH_GITHUB_SECRET ?? "",
      }),
      GoogleProvider({
        clientId: process.env.AUTH_GOOGLE_ID ?? "",
        clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
      })
    ],
    callbacks: {
      async jwt({ token, account, profile }: { token: JWT; account: Account | null; profile?: Profile }) {
        // Persist the OAuth access_token to the token right after signin
        if (account) {
          token.providerAccessToken = account.access_token;
          
          // For Google, use email as a stable identifier
          if (account.provider === 'google' && profile?.email) {
            token.sub = profile.email;
          }
        }

        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
          const tokenUrl = `${apiUrl}/auth/token`;
          console.log('Fetching API token from:', tokenUrl);
          
          const response = await axios.post(`${apiUrl}/auth/token`, {
            sub: token.sub,
            name: token.name,
            email: token.email
          });

          token.apiAccessToken = response.data.token;
          console.log('Received API token successfully');
        } catch (error: unknown) {
          if (error instanceof Error) {
            console.error('Error getting JWT token:', error.message);
          }
          if (axios.isAxiosError(error)) {
            console.error('Axios error details:', {
              response: error.response?.data,
              status: error.response?.status,
            });
          }
        }

        return token
      },
      async session({ session, token }: { session: AppSession; token: JWT }) {
        // Send properties to the client, like an access_token from a provider.
        (session as AppSession).providerAccessToken = token.providerAccessToken as string;
        (session as AppSession).apiAccessToken = token.apiAccessToken as string;
        
        // Debug log
        console.log('Session updated with tokens:', {
          hasProviderToken: !!session.providerAccessToken,
          hasApiToken: !!session.apiAccessToken
        });
        
        return session as AppSession;
      }
    }
  };
 
export const handlers = NextAuth(authOptions);
