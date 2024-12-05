"use client";

import { useState, ReactNode, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AuthButton from '@/components/AuthButton';
import UserMenu from '@/components/UserMenu';
import PDFViewerControls from '@/components/PDFViewerControls';
import {
  Bars3Icon,
  ChartPieIcon,
  ArrowUpTrayIcon,
  ListBulletIcon,
  CubeIcon,
  Square3Stack3DIcon,
  BeakerIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';

// First, let's fix the type errors
interface PDFViewerControlsType {
  showLeftPanel: boolean;
  setShowLeftPanel: React.Dispatch<React.SetStateAction<boolean>>;
  showPdfPanel: boolean;
  setShowPdfPanel: React.Dispatch<React.SetStateAction<boolean>>;
}

declare global {
  interface Window {
    pdfViewerControls?: PDFViewerControlsType;
  }
}

// Update the icon type
interface MenuItem {
  text: string;
  icon: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement>>;
  href: string;
  tooltip: string;
}

const fileMenuItems = [
  { text: 'Dashboard', icon: ChartPieIcon, tooltip: 'Dashboard', href: '/dashboard' },
  { text: 'Upload', icon: ArrowUpTrayIcon, tooltip: 'Upload', href: '/upload' },
  { text: 'List Files', icon: ListBulletIcon, tooltip: 'List Files', href: '/list' },
];

const modelMenuItems = [
  { text: 'Schemas', icon: TableCellsIcon, tooltip: 'Schemas', href: '/schemas' },
  { text: 'Models', icon: CubeIcon, tooltip: 'Models', href: '/models' },
];

const flowMenuItems = [
  { text: 'Flows', icon: Square3Stack3DIcon, tooltip: 'Flows', href: '/flows' },
];

const debugMenuItems = [
  { text: 'Test', icon: BeakerIcon, tooltip: 'Test Page', href: '/test' },
];

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [open, setOpen] = useState(true);
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const isPDFViewer = pathname.startsWith('/pdf-viewer/');
  const [forceUpdate, setForceUpdate] = useState(0);
  const [pdfControls, setPdfControls] = useState<PDFViewerControlsType | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setOpen(window.innerWidth > 640);
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keep the existing PDF controls effects
  useEffect(() => {
    const handleControlsChange = () => {
      setForceUpdate(prev => prev + 1);
    };
    
    window.addEventListener('pdfviewercontrols', handleControlsChange);
    return () => window.removeEventListener('pdfviewercontrols', handleControlsChange);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPdfControls(window.pdfViewerControls || null);
    }
  }, [forceUpdate]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin');
    }
  }, [status, router]);

  // Update the renderMenuItem function to match burger icon size and alignment
  const renderMenuItem = (item: MenuItem) => {
    const Icon = item.icon;
    const isSelected = pathname === item.href;
    
    return (
      <Link
        key={item.text}
        href={item.href}
        className="block px-2 py-1"
        title={!open ? item.tooltip : ''}
      >
        <button
          className={`
            flex items-center
            h-10 w-full
            rounded-md
            ${isSelected ? 'bg-blue-100' : 'hover:bg-blue-100'} dark:hover:bg-gray-800
            transition-colors duration-200
            text-left
            px-3
          `}
        >
          <div className={`
            flex
            ${open ? 'justify-start w-6' : 'justify-center w-6'}
          `}>
            <Icon className="h-6 w-6 shrink-0" />
          </div>
          {open && (
            <span className={`ml-3 pr-3 text-sm font-medium whitespace-nowrap ${isSelected ? 'text-blue-600' : 'text-gray-700 dark:text-gray-200'}`}>
              {item.text}
            </span>
          )}
        </button>
      </Link>
    );
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="bg-blue-600 dark:bg-blue-800 border-b border-blue-700 dark:border-blue-900">
        <div className="flex h-16 items-center justify-between px-3">
          <div className="flex items-center">
            <button
              onClick={() => setOpen(!open)}
              className="p-2 rounded-md hover:bg-blue-500 dark:hover:bg-blue-700"
            >
              <Bars3Icon className="h-6 w-6 text-white" />
            </button>
            <Link href="/" className={`${open ? 'ml-3' : 'ml-6'} text-xl font-semibold text-white`}>
              Smart Document Router
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {isPDFViewer && pdfControls && (
              <PDFViewerControls key={forceUpdate} {...pdfControls} />
            )}
            {session ? (
              <UserMenu user={session?.user} />
            ) : (
              <AuthButton />
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside 
          className={`
            flex-shrink-0 
            transition-all duration-300 ease-in-out 
            bg-blue-50
            border-r border-gray-200 dark:border-gray-800
            ${open ? 'w-50' : 'w-16'}
          `}
        >
          <nav className="flex h-full flex-col overflow-hidden">
            {status === 'authenticated' && (
              <>
                <div className="py-1">
                  {fileMenuItems.map(renderMenuItem)}
                </div>
                <hr className="border-gray-200 dark:border-gray-800" />
                <div className="py-1">
                  {modelMenuItems.map(renderMenuItem)}
                </div>
                <hr className="border-gray-200 dark:border-gray-800" />
                <div className="py-1">
                  {flowMenuItems.map(renderMenuItem)}
                </div>
              </>
            )}
            <hr className="border-gray-200 dark:border-gray-800" />
            <div className="py-1">
              {debugMenuItems.map(renderMenuItem)}
            </div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
