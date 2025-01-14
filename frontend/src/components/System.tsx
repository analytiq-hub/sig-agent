import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWind, faBars, faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import { useSession } from 'next-auth/react';
const System: React.FC = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const { data: session } = useSession();
  console.log('Session:', session);
  console.log('Session user:', session?.user);
  console.log('Session role:', session?.user?.role); // Should be properly typed

  return (
    <div className="p-2">
      <h1 className="text-2xl font-bold">System Page</h1>
      <p>This is the system page (under construction)</p>
    </div>
  );
};

export default System;