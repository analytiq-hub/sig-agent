import { handlers } from "@/auth" // Referring to the auth.ts we just created
export const { GET, POST } = handlers

import NextAuth from "next-auth"
   import GoogleProvider from "next-auth/providers/google"

   export default NextAuth({
     providers: [
       GoogleProvider({
         clientId: process.env.GOOGLE_CLIENT_ID,
         clientSecret: process.env.GOOGLE_CLIENT_SECRET,
       }),
     ],
     // Add any additional configuration options here
   })