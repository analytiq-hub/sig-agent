import { useAppSession } from '@/contexts/AppSessionContext';
const System: React.FC = () => {
  const { session } = useAppSession();
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