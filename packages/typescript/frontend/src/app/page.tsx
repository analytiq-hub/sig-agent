'use client'

import React, { useState, useEffect } from 'react';

const Home = () => {
  const [baseUrl, setBaseUrl] = useState('');

  // Get the base URL for internal links
  const getBaseUrl = () => {
    if (typeof window === 'undefined') return '';
    return window.location.origin;
  };

  // (FastAPI URL helper removed because it was unused)

  useEffect(() => {
    setBaseUrl(getBaseUrl());
  }, []);
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <header className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            <span>SigAgent.AI</span>
          </h1>
          <div className="text-lg md:text-xl text-gray-600 space-y-1">
            <p>Advanced monitoring and telemetry</p>
            <p>for Claude Agents</p>
          </div>
        </header>
        
        <main>
          <div className="space-y-8">
            {/* Client Setup - Full Width Priority */}
            <section className="bg-white rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Client Setup</h2>

              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <ol className="list-decimal list-inside text-blue-800 text-sm space-y-2">
                  <li>
                    <a 
                      href={`${baseUrl}/settings/user/developer/organization-access-tokens`}
                      className="text-blue-600 hover:text-blue-800 underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Create an organization access token
                    </a>
                  </li>
                  <li>
                    Run the following and provide the org token when prompted:
                    <div className="mt-3 bg-gray-900 rounded-lg p-4 text-green-400 font-mono text-sm overflow-x-auto">
                      <span className="text-white">npx</span> <span className="text-green-300">-y</span> <span className="text-white">@sigagent/cli</span> <span className="text-yellow-400">setup</span>
                    </div>
                  </li>
                  <li>
                    Restart Claude Code.
                  </li>
                </ol>
              </div>

            </section>

            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
            <strong>Note:</strong> Claude Code hooks and traces are only supported with
            Claude Code <span className="font-semibold">Pro</span> and <span className="font-semibold">Max</span> subscriptions.
            </div>
        
            {/* About and Contact - Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* About Section */}
              <section className="bg-white rounded-lg shadow-lg p-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">About SigAgent.AI</h2>
                <p className="text-gray-600 mb-6">
                  SigAgent.AI is a comprehensive monitoring and telemetry platform designed specifically for Claude Agents. 
                </p>
                <p className="text-gray-600 mb-6">
                  <strong>Get started for free with no credit card required.</strong>
                </p>
                
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Key Features</h3>
                  <ul className="list-disc list-inside text-gray-600 space-y-2">
                    <li>Real-time telemetry collection from Claude Agents</li>
                    <li>Advanced analytics and performance monitoring</li>
                    <li>OTLP-compatible data export and integration</li>
                    <li>Comprehensive metrics and logging visualization</li>
                    <li>Secure authentication and data protection</li>
                  </ul>
                </div>
              </section>

              {/* Contact Us Section */}
              <section className="bg-white rounded-lg shadow-lg p-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
                <p className="text-gray-600 mb-4">
                  Get in touch for inquiries, partnerships, or more information about our products.
                </p>
                <ul className="text-gray-600 space-y-2">
                  <li>Email: <a href="mailto:andrei@analytiqhub.com" className="text-blue-600 hover:text-blue-800">andrei@analytiqhub.com</a></li>
                  <li>Website: <a href="https://analytiqhub.com" className="text-blue-600 hover:text-blue-800">analytiqhub.com</a></li>
                </ul>
              </section>
            </div>
          </div>
        </main>
        
        <footer className="mt-12 text-center text-gray-600">
          <p>&copy; 2024 SigAgent.AI. All rights reserved.</p>
          <div className="mt-4">
            <a 
              href="https://github.com/analytiq-hub/sig-agent" 
              className="text-blue-600 hover:text-blue-800"
            >
              View on GitHub
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Home;
