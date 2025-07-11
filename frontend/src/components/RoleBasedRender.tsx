'use client'

import { useRole } from "@/utils/roles";
import { ReactNode } from "react";

interface RoleBasedRenderProps {
  children: ReactNode;
  allowedRoles: string[];
}

const RoleBasedRender: React.FC<RoleBasedRenderProps> = ({ 
  children, 
  allowedRoles 
}) => {
  const { role } = useRole();
  
  if (!role || !allowedRoles.includes(role)) {
    return null;
  }

  return <>{children}</>;
};

export default RoleBasedRender;