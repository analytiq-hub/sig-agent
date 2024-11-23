import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWind } from '@fortawesome/free-solid-svg-icons';

const Test: React.FC = () => {
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
    </div>
  );
};

export default Test;
