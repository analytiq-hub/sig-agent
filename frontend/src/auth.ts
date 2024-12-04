import axios from 'axios';
import NextAuth, { NextAuthOptions } from "next-auth"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import mongoClient from "@/utils/mongodb"

import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { JWT } from "next-auth/jwt";
import { AppSession } from '@/app/types/AppSession';
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";

export const authOptions: NextAuthOptions = {
    session: {
        strategy: 'jwt' as const,
    },
    adapter: MongoDBAdapter(mongoClient),
    secret: process.env.NEXTAUTH_SECRET ?? "",
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Missing credentials");
                }

                try {
                    const db = mongoClient.db();
                    const user = await db.collection("users").findOne({ 
                        email: credentials.email 
                    });

                    if (!user || !user.password) {
                        throw new Error("No user found with this email");
                    }

                    const isValid = await compare(credentials.password, user.password);
                    
                    if (!isValid) {
                        throw new Error("Invalid password");
                    }

                    return {
                        id: user._id.toString(),
                        email: user.email,
                        name: user.name
                    };
                } catch (error) {
                    console.error("Auth error:", error);
                    return null;
                }
            }
        }),
        GithubProvider({
            clientId: process.env.AUTH_GITHUB_ID ?? "", // ?? only considers null or undefined as false
            clientSecret: process.env.AUTH_GITHUB_SECRET ?? "",
        }),
        GoogleProvider({
            clientId: process.env.AUTH_GOOGLE_ID ?? "",
            clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
            authorization: {
                params: {
                    prompt: "consent",
                    access_type: "offline",
                    response_type: "code",
                    // redirect_uri: 'http://localhost:3000/api/auth/callback/google'
                }
            }
        })
    ],
    callbacks: {
        async signIn({ user, account }) {
            try {
                if (account?.provider === 'google' || account?.provider === 'github') {
                    const db = mongoClient.db();
                    const users = db.collection("users");

                    const existingUser = await users.findOne({ email: user.email });

                    if (existingUser) {
                        await users.updateOne(
                            { email: user.email },
                            {
                                $addToSet: {
                                    accounts: {
                                        provider: account.provider,
                                        providerAccountId: account.providerAccountId
                                    }
                                }
                            }
                        );
                    }
                }
                return true;
            } catch (error) {
                console.error("Account linking error:", error);
                return false;
            }
        },
        async jwt({ token, account, profile, trigger, session }) {
            // If name is being updated, update the token
            if (trigger === "update" && session?.user?.name) {
                token.name = session.user.name;
            }

            // Persist the OAuth access_token to the token right after signin
            if (account) {
                token.providerAccessToken = account.access_token;
                
                // For Google, use email as a stable identifier
                if (account.provider === 'google' && profile?.email) {
                    token.sub = profile.email;
                }
            }

            try {
                // This API executes from the nextjs backend, and needs to reach the fastapi backend
                const apiUrl = process.env.FASTAPI_BACKEND_URL || 'http://127.0.0.1:8000';
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
            // Send properties to the client
            (session as AppSession).providerAccessToken = token.providerAccessToken as string;
            (session as AppSession).apiAccessToken = token.apiAccessToken as string;
            
            if (session.user) {
                session.user.name = token.name;
            }
            
            return session as AppSession;
        }
    }
};

export const handlers = NextAuth(authOptions);