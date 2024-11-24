import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWind, faBars, faChevronLeft } from '@fortawesome/free-solid-svg-icons';

const Test: React.FC = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div>
      <nav className="w-full sticky top-0 z-10 bg-blue-900">
        <div className="container mx-auto flex justify-between items-center py-4">
          <div className="flex-shrink-0 ml-6 cursor-pointer">
            <FontAwesomeIcon icon={faWind} className="text-2xl text-yellow-500" />
            <span className="text-xl font-semibold text-blue-200">Smart Document Router</span>
          </div>
          <ul className="flex mr-10 font-semibold-sm">
            <li className="mr-6 p-1 border-b-2 border-yellow-500">
              <a className="cursor-default text-blue-200" href="#">Dashboard</a>
            </li>
            <li className="mr-6 p-1 border-b-2 border-yellow-500">
              <a className="text-white hover:text-blue-300" href="#">Upload</a>
            </li>
            <li className="mr-6 p-1">
              <a className="text-white hover:text-blue-300 whitespace-nowrap" href="#">List Files</a>
            </li>
            <li className="mr-6 p-1">
              <a className="text-white hover:text-blue-300" href="#">Models</a>
            </li>
            <li className="mr-6 p-1">
              <a className="text-white hover:text-blue-300" href="#">Flows</a>
            </li>
          </ul>
        </div>
      </nav>
      <div className="antialiased min-h-screen relative lg:flex">
        <nav className={`absolute lg:relative z-10 w-80 bg-indigo-900 text-white h-screen p-3 transform transition-transform duration-200 ease-in-out lg:transform-none ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}>
          <div className="flex justify-between">
            <span className="font-bold text-2xl sm:text-3xl p-2">Sidebar</span>
            <button 
              className="p-2 focus:outline-none focus:bg-indigo-800 hover:bg-indigo-800 rounded-md lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <FontAwesomeIcon icon={faChevronLeft} className="h-6 w-6" />
            </button>
          </div>
          
          <ul className="mt-8">
            <li className="block px-4 py-2 hover:bg-indigo-800 rounded-md">
              <a href="/dashboard" className="flex items-center">
                Dashboard
              </a>
            </li>
            <li className="block px-4 py-2 hover:bg-indigo-800 rounded-md">
              <a href="/upload" className="flex items-center">
                Upload
              </a>
            </li>
            <li className="block px-4 py-2 hover:bg-indigo-800 rounded-md">
              <a href="/list" className="flex items-center">
                List Files
              </a>
            </li>
            <li className="block px-4 py-2 hover:bg-indigo-800 rounded-md">
              <a href="/models" className="flex items-center">
                Models
              </a>
            </li>
            <li className="block px-4 py-2 hover:bg-indigo-800 rounded-md">
              <a href="/flows" className="flex items-center">
                Flows
              </a>
            </li>
          </ul>
        </nav>

        <div className="relative z-0 lg:flex-grow">
          <header className="flex bg-gray-700 text-white items-center px-3">
            <button
              className="p-2 focus:outline-none focus:bg-gray-600 hover:bg-gray-600 rounded-md lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <FontAwesomeIcon icon={faBars} className="h-6 w-6" />
            </button>
            <span className="block text-2xl sm:text-3xl font-bold p-4">
              Smart Document Router
            </span>
          </header>
          {/* Main content goes here */}
        </div>
      </div>
    </div>
  );
};

export default Test;
