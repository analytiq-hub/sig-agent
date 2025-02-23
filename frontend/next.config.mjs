/** @type {import('next').NextConfig} */
//import { withPlugins } from 'next-compose-plugins';
import TerserPlugin from 'terser-webpack-plugin';

const nextConfig = {
  // Modify build cache configuration
  experimental: {
    // Remove turbotrace as it can cause hanging
    // turbotrace: {
    //   enabled: true,
    // },
    // Use SWC minification instead
    swcMinify: true,
    // Configure tracing in experimental
    outputFileTracingExcludes: {
      '*': [
        '@swc/core',
        'esbuild',
        // Add other modules to exclude if needed
      ],
    },
  },
  
  // Enable standalone output
  output: 'standalone',
  
  // Enable file tracing
  outputFileTracing: true,
  
  webpack: (config) => {
    if (config.optimization) {
      config.optimization.minimizer = [
        new TerserPlugin({
          terserOptions: {
            // Your Terser options here
          },
          exclude: /pdf.worker.min.mjs/,
        }),
      ];
    }
    return config;
  },
};

export default nextConfig;
