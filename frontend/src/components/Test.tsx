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
            <li className="mr-6 p-1 border-b-2 border-yellow-500">
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

      <div class="mx-auto p-8 w-full lg:w-1/2">

      <h1 class="text-3xl font-bold">Grid Layout Examples</h1>

      <h2 class="my-6 text-2xl underline underline-offset-2">Example #1</h2>

      <div class="grid grid-rows-3 grid-cols-3 gap-x-4 gap-y-2">
        <div class="box col-span-2 bg-green-500">1</div>
        <div class="box row-span-2 bg-green-500">2</div>
        <div class="box row-span-2 bg-green-500">3</div>
        <div class="box bg-green-500">4</div>
        <div class="box col-span-2 bg-green-500">5</div>


      </div>


    </div>
    </div>
  );
};

export default Test;
