import { useSession } from "next-auth/react";
import { AppSession } from "@/types/AppSession";
import { Organization } from "@/types/organizations";

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
export function isSysAdmin(session: AppSession | null): boolean {
  return session?.user?.role === 'admin';
}

/**
 * Utility function to check if the current user is an admin of a specific organization
 * @param organization - The organization to check admin status for
 * @param session - The current session object
 * @returns boolean indicating if user is organization admin
 */
export function isOrgAdmin(organization: Organization, session: AppSession | null): boolean {
  return organization.members.some(
    member => member.user_id === session?.user?.id && member.role === 'admin'
  );
} 