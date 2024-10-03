import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

export const authOptions = {
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
  };