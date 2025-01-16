'use client'

import { Fragment, useEffect } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';

const typeLabels = {
  individual: { bg: 'bg-gray-100', text: 'text-gray-600' },
  team: { bg: 'bg-blue-100', text: 'text-blue-600' },
  enterprise: { bg: 'bg-purple-100', text: 'text-purple-600' }
};

export default function OrganizationSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { currentOrganization, switchOrganization, organizations, isLoading, refreshOrganizations } = useOrganization();
  const { data: session, status } = useSession();

  const handleOrganizationSwitch = (organizationId: string) => {
    switchOrganization(organizationId);
    
    // If we're on an organization-specific route, update the URL
    if (pathname.includes('/orgs/')) {
      const newPath = pathname.replace(
        /\/orgs\/[^/]+/,
        `/orgs/${organizationId}`
      );
      router.push(newPath);
    }
  };

  useEffect(() => {
    let mounted = true;

    if (status === 'authenticated' && session?.user && mounted) {
      refreshOrganizations();
    }

    return () => {
      mounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (status === 'loading' || isLoading || !organizations) {
    return (
      <div className="text-gray-200 text-base font-medium px-3 py-2 mr-4 flex items-center">
        <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Loading...
      </div>
    );
  }

  if (!currentOrganization || organizations.length === 0) {
    return <div className="text-gray-200 text-base font-medium px-3 py-2 mr-2">No organization available</div>;
  }

  if (organizations.length === 1) {
    return (
      <div className="text-gray-200 text-base font-medium px-3 py-2 mr-2">
        {currentOrganization.name}
      </div>
    );
  }

  return (
    <Menu as="div" className="relative inline-block text-left mr-2">
      <Menu.Button className="inline-flex w-full justify-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
        {currentOrganization.name}
        <ChevronDownIcon className="-mr-1 h-5 w-5 text-gray-400" aria-hidden="true" />
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="py-1">
            {organizations.map((organization) => (
              <Menu.Item key={organization.id}>
                {({ active }) => (
                  <div
                    onClick={() => handleOrganizationSwitch(organization.id)}
                    className={`
                      ${active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'}
                      px-4 py-2 text-sm w-full text-left flex items-center justify-between cursor-pointer
                    `}
                  >
                    <span>{organization.name}</span>
                    <span className={`text-xs ml-2 px-2 py-1 rounded-full ${typeLabels[organization.type].bg} ${typeLabels[organization.type].text}`}>
                      {organization.type}
                    </span>
                  </div>
                )}
              </Menu.Item>
            ))}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}