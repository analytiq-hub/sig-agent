import { useSession } from "next-auth/react";

export function useRole() {
  const { data: session } = useSession();
  
  return {
    isAdmin: session?.user?.role === "admin",
    role: session?.user?.role,
  };
}
