import React from 'react';

const Home = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-center">Welcome to Document Proxy</h1>
      </header>
      
      <main>
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">About Doc Proxy</h2>
          <p className="text-lg">
            Doc Proxy is an intelligent document router that can sit in front
            of ERPs and facilitate AI autonomous processing of docs.
          </p>
        </section>
        
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Features</h2>
          <ul className="list-disc list-inside">
            <li>Connector support (future): REST, Email, SFTP, Fax</li>
            <li>ERP support (future): SAP, Oracle, JD Edwards</li>
          </ul>
        </section>
      </main>
      
      <footer className="mt-8 text-center text-gray-500">
        <p>&copy; 2024 Analytiq Hub. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Home;
