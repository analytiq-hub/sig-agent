import NextAuth from "next-auth"

declare module "next-auth" {
  interface User {
    id: string
    role: 'admin' | 'user'
    email: string;
    name?: string | null;
  }

  interface Session {
    user: User
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email?: string | null;
    name?: string | null;
    role: string;
  }
}
