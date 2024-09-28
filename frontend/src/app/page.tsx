import React from 'react';
import Link from 'next/link';

const Home = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-center">Welcome to My App</h1>
      </header>
      
      <main>
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">About Doc Proxy</h2>
          <p className="text-lg">
            This is a brief description of what our app does and why it's awesome.
          </p>
        </section>
        
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Features</h2>
          <ul className="list-disc list-inside">
            <li>Feature 1</li>
            <li>Feature 2</li>
            <li>Feature 3</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-2xl font-semibold mb-4">Get Started</h2>
          <Link href="/signup" className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
            Sign Up Now
          </Link>
        </section>
      </main>
      
      <footer className="mt-8 text-center text-gray-500">
        <p>&copy; 2023 My App. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Home;
