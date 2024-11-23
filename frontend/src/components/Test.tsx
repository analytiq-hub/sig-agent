import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWind } from '@fortawesome/free-solid-svg-icons';

const Test: React.FC = () => {
  return (
    <div>
      <div className="container mx-auto">
        <nav className="flex justify-between items-center sticky top-0 z-10 py-4 bg-blue-900">
          <div className="flex-shrink-0 ml-6 cursor-pointer">
            <FontAwesomeIcon icon={faWind} className="text-2xl text-yellow-500" />
            <span className="text-3xl font-semibold text-blue-200">Tailwind School</span>
          </div>
          <ul className="flex mr-10 font-semibold">
            <li className="mr-6 p-1 border-b-2 border-yellow-500">
              <a className="cursor-default text-blue-200" href="#">Home</a>
            </li>
            <li className="mr-6 p-1">
              <a className="text-white hover:text-blue-300" href="#">News</a>
            </li>
            <li className="mr-6 p-1">
              <a className="text-white hover:text-blue-300" href="#">Tutorials</a>
            </li>
            <li className="mr-6 p-1">
              <a className="text-white hover:text-blue-300" href="#">Videos</a>
            </li>
          </ul>
        </nav>
      </div>
      
      <nav className="flex items-center justify-between p-4">
        <div>
          <h1>Logo</h1>
        </div>
        
        <div> 
          <ul className="flex mr-5">
            <li className="mr-6 p-1">Nav Links</li>
            <li className="mr-6 p-1">Nav Links</li>
          </ul>
        </div>
      </nav>
    </div>
  );
};

export default Test;
