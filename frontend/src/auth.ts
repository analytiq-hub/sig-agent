import NextAuth, { NextAuthOptions } from "next-auth"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import client from "./lib/mongodb"

import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { JWT } from "next-auth/jwt";
import { Account, Session } from "next-auth";
import jwt from 'jsonwebtoken'; // You'll need to install this package

interface CustomSession extends Session {
  providerAccessToken?: string;
  apiAccessToken?: string;
}

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
      async jwt({ token, account }: { token: JWT; account: Account | null }) {
        // Persist the OAuth access_token to the token right after signin
        if (account) {
          token.providerAccessToken = account.access_token
        }

        // Generate our own access token
        if (!token.apiAccessToken) {
          token.apiAccessToken = jwt.sign(
            { userId: token.sub, email: token.email },
            process.env.JWT_SECRET!, // Make sure to set this in your environment variables
            { expiresIn: '1h' } // Set an expiration time as needed
          );
        }

        console.log('token', token);
        return token
      },
      async session({ session, token }: { session: Session; token: JWT }) {
        // Send properties to the client, like an access_token from a provider.
        (session as CustomSession).providerAccessToken = token.providerAccessToken as string;
        (session as CustomSession).apiAccessToken = token.apiAccessToken as string;
        console.log('session', session);
        return session as CustomSession;
      }
    }
  };
 
export const handlers = NextAuth(authOptions);
