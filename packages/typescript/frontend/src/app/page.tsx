'use client'

import React, { useState, useEffect } from 'react';

const Home = () => {
  const [otlpEndpoint, setOtlpEndpoint] = useState('');
  const [baseUrl, setBaseUrl] = useState('');

  // Get the base URL from window.location and replace the port with 4317
  const getOtlpEndpoint = () => {
    if (typeof window === 'undefined') return '';
    const baseUrl = window.location.origin;
    const url = new URL(baseUrl);
    // Strip any existing port and use 4317
    return `${url.protocol}//${url.hostname}:4317`;
  };

  // Get the base URL for internal links
  const getBaseUrl = () => {
    if (typeof window === 'undefined') return '';
    return window.location.origin;
  };

  // Get the FastAPI URL using the same mechanism as settings page
  const getFastApiUrl = () => {
    return process.env.NEXT_PUBLIC_FASTAPI_FRONTEND_URL || 'http://localhost:8000';
  };

  useEffect(() => {
    setOtlpEndpoint(getOtlpEndpoint());
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
            {/* Top Row - About and Setup Instructions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* About Section */}
              <section className="bg-white rounded-lg shadow-lg p-8 flex flex-col">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">About SigAgent.AI</h2>
                <p className="text-gray-600 mb-6 flex-grow">
                  SigAgent.AI is a comprehensive monitoring and telemetry platform designed specifically for Claude Agents. 
                </p>
                <p className="text-gray-600 mb-6 flex-grow">
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

              {/* Setup Instructions */}
              <section className="bg-white rounded-lg shadow-lg p-8 flex flex-col">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Client Setup</h2>

                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-blue-800 text-sm">
                    <a 
                      href={`${baseUrl}/settings/user/developer/organization-access-tokens`}
                      className="text-blue-600 hover:text-blue-800 underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Create an organization access token
                    </a>
                    &nbsp;and use it in steps 4 and 5. Then, configure the following environment variables before starting Claude Code:
                  </p>
                </div>
                <div className="bg-gray-900 rounded-lg p-6 text-green-400 font-mono text-xs overflow-x-auto flex-grow">
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
                  
                  <div className="mb-4">
                    <span className="text-gray-400"># 4. Set authentication (replace with your org access token)</span><br/>
                    <span className="text-blue-400">export</span> <span className="text-yellow-400">OTEL_EXPORTER_OTLP_HEADERS</span>=<span className="text-green-300">&quot;Authorization=Bearer YOUR_ORG_ACCESS_TOKEN&quot;</span>
                  </div>
                  
                  <div className="mb-4">
                    <span className="text-gray-400"># 5. Configure <strong>sig-agent-plugin</strong> environment variables</span><br/>
                    <span className="text-blue-400">export</span> <span className="text-yellow-400">CLAUDE_HOOK_MONITOR_URL</span>=<span className="text-green-300">&quot;{getFastApiUrl()}/v0/claude/log&quot;</span><br/>
                    <span className="text-blue-400">export</span> <span className="text-yellow-400">CLAUDE_HOOK_MONITOR_TOKEN</span>=<span className="text-green-300">&quot;YOUR_ORG_ACCESS_TOKEN&quot;</span>
                  </div>
                </div>
              </section>
            </div>

            {/* Claude Plugin Setup Section */}
            <section className="bg-white rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Claude Setup For <strong className="text-blue-600">sig-agent-plugin</strong></h2>
              <p className="text-gray-600 mb-6">
                Set up the <strong className="text-blue-600">sig-agent-marketplace</strong> directly in Claude to monitor tool usage and interactions. 
                The environment variables are already configured above in the Client Setup section.
              </p>
              
              <div className="space-y-6">
                {/* Step 1: Add Marketplace */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">1. Add the <strong className="text-blue-600">sig-agent-marketplace</strong> to Claude</h3>
                  <p className="text-gray-600 mb-3">
                    In Claude, run the following command:
                  </p>
                  <div className="bg-gray-900 rounded-lg p-4 text-green-400 font-mono text-sm overflow-x-auto">
                    <span className="text-blue-400">/plugin</span> <span className="text-yellow-400">marketplace</span> <span className="text-yellow-400">add</span> <span className="text-green-300">https://github.com/analytiq-hub/sig-agent-marketplace.git</span>
                  </div>
                </div>

                {/* Step 2: Enable Plugin */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">2. Enable the <strong className="text-blue-600">sig-agent-plugin</strong> in Claude</h3>
                  <p className="text-gray-600 mb-3">
                    In Claude, use the <strong className="text-blue-600">/plugin</strong> command to enable the <strong className="text-blue-600">sig-agent-plugin</strong>.
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 text-sm">
                  <strong>Note:</strong> The environment variables <code>CLAUDE_HOOK_MONITOR_URL</code> and <code>CLAUDE_HOOK_MONITOR_TOKEN</code>  are configured in the Client Setup section above. The plugin will automatically use these to send monitoring data to SigAgent.AI.
                </p>
              </div>
            </section>

            {/* Bottom Row - Contact Us (Full Width) */}
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
