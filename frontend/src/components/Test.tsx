import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWind } from '@fortawesome/free-solid-svg-icons';

const Test: React.FC = () => {
  return (
    <div className="antialiased min-h-screen relative">
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
              <a className="text-white hover:text-blue-300" href="#">List Files</a>
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
      <nav className="absolute z-10 w-80 bg-indigo-900 text-white h-screen p-3">
        <div className="flex justify-between">
          <span className="font-bold text-xl sm:text-2xl p-2">Sidebar</span>
          <button className="p-2 focus:outline-none ml-auto focus:bg-indigo-800 hover:bg-indigo-800 rounded-md">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
        </div>
        <ul className="mt-8">
          <li className="block px-4 py-2 hover:bg-indigo-800 rounded-md">
            <a href="dashboard" className="flex items-center">Dashboard</a>
          </li>
          <li className="block px-4 py-2 hover:bg-indigo-800 rounded-md">
            <a href="upload" className="flex items-center">Upload</a>
          </li>
          <li className="block px-4 py-2 hover:bg-indigo-800 rounded-md">
            <a href="list" className="flex items-center">List Files</a>
          </li>
          <li className="block px-4 py-2 hover:bg-indigo-800 rounded-md">
            <a href="models" className="flex items-center">Models</a>
          </li>
          <li className="block px-4 py-2 hover:bg-indigo-800 rounded-md">
            <a href="flows" className="flex items-center">Flows</a>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default Test;
