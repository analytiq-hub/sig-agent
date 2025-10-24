'use client'

import React, { useState, useEffect } from 'react';

const Home = () => {
  const [otlpEndpoint, setOtlpEndpoint] = useState('');

  // Get the base URL from window.location and replace the port with 4317
  const getOtlpEndpoint = () => {
    const baseUrl = window.location.origin;
    const url = new URL(baseUrl);
    // Strip any existing port and use 4317
    return `${url.protocol}//${url.hostname}:4317`;
  };

  // Get the base URL for internal links
  const getBaseUrl = () => {
    return window.location.origin;
  };

  useEffect(() => {
    setOtlpEndpoint(getOtlpEndpoint());
  }, []);
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <header className="text-center mb-12 hidden md:block">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            <span>SigAgent.AI</span>
          </h1>
          <div className="text-xl text-gray-600 space-y-1">
            <p>Advanced monitoring and telemetry</p>
            <p>for Claude Agents</p>
          </div>
        </header>
        
        <main>
          {/* Setup Section */}
          <section className="bg-white rounded-lg shadow-lg p-8 mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Setup Instructions</h2>
            <p className="text-gray-600 mb-6">
              To set up SigAgent.AI for monitoring your Claude Agents, configure the following environment variables before starting Claude Code:
            </p>
            
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 text-sm">
                <strong>Note:</strong> You&apos;ll need to create an organization access token first and use it in step 4. 
                <a 
                  href={`${getBaseUrl()}/settings/user/developer/organization-access-tokens`}
                  className="text-blue-600 hover:text-blue-800 underline ml-1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Set up your access token here →
                </a>
              </p>
            </div>
            
            <div className="bg-gray-900 rounded-lg p-6 text-green-400 font-mono text-sm overflow-x-auto">
              <div className="mb-4">
                <span className="text-gray-400"># 1. Enable telemetry</span><br/>
                <span className="text-blue-400">export</span> <span className="text-yellow-400">CLAUDE_CODE_ENABLE_TELEMETRY</span>=<span className="text-green-300">1</span>
              </div>
              
              <div className="mb-4">
                <span className="text-gray-400"># 2. Enable exporters</span><br/>
                <span className="text-blue-400">export</span> <span className="text-yellow-400">OTEL_METRICS_EXPORTER</span>=<span className="text-green-300">otlp</span><br/>
                <span className="text-blue-400">export</span> <span className="text-yellow-400">OTEL_LOGS_EXPORTER</span>=<span className="text-green-300">otlp</span>
              </div>
              
              <div className="mb-4">
                <span className="text-gray-400"># 3. Configure OTLP endpoint</span><br/>
                <span className="text-blue-400">export</span> <span className="text-yellow-400">OTEL_EXPORTER_OTLP_PROTOCOL</span>=<span className="text-green-300">grpc</span><br/>
                <span className="text-blue-400">export</span> <span className="text-yellow-400">OTEL_EXPORTER_OTLP_ENDPOINT</span>=<span className="text-green-300">{otlpEndpoint}</span>
              </div>
              
              <div>
                <span className="text-gray-400"># 4. Set authentication (replace with your org access token)</span><br/>
                <span className="text-blue-400">export</span> <span className="text-yellow-400">OTEL_EXPORTER_OTLP_HEADERS</span>=<span className="text-green-300">&quot;Authorization=Bearer YOUR_ORG_ACCESS_TOKEN&quot;</span>
              </div>
            </div>
          </section>

          {/* About Section */}
          <section className="bg-white rounded-lg shadow-lg p-8 mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">About</h2>
            <p className="text-gray-600 mb-6">
              SigAgent.AI is a comprehensive monitoring and telemetry platform designed specifically for Claude Agents. 
              It provides real-time insights, performance metrics, and detailed analytics to help you optimize your AI agent deployments.
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

          {/* Contact Section */}
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
