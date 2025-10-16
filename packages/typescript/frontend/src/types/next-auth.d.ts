import { DefaultUser, DefaultSession } from "next-auth"

declare module "next-auth" {
  interface User extends DefaultUser {
    id: string
    role: string
    email: string;
    name?: string | null;
  }

  interface Session extends DefaultSession {
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
