import { useSession } from "next-auth/react";
import { Organization } from "@/types/organizations";
import { Session } from "next-auth";

export function useRole() {
  const { data: session } = useSession();
  
  return {
    role: session?.user?.role,
  };
}

/**
 * Utility function to check if the current user is a system admin
 * @param session - The current session object
 * @returns boolean indicating if user is system admin
 */
export function isSysAdmin(session: Session | null): boolean {
  return session?.user?.role === 'admin';
}

/**
 * Utility function to check if the current user is an admin of a specific organization
 * @param organization - The organization to check admin status for
 * @param session - The current session object
 * @returns boolean indicating if user is organization admin
 */
export function isOrgAdmin(organization: Organization, session: Session | null): boolean {
  return organization.members.some(
    member => member.user_id === session?.user?.id && member.role === 'admin'
  );
} 