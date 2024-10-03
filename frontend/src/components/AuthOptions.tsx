import GithubProvider from "next-auth/providers/github";

export const authOptions = {
    providers: [
      GithubProvider({
        clientId: process.env.GITHUB_ID ?? "", // ?? only considers null or undefined as false
        clientSecret: process.env.GITHUB_SECRET ?? "",
      })
    ],
  };