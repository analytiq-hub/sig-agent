import { useSession } from "next-auth/react";

export function useRole() {
  const { data: session } = useSession();
  
  return {
    role: session?.user?.role,
  };
}
