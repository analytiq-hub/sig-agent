/** @type {import('next').NextConfig} */
//import { withPlugins } from 'next-compose-plugins';
import TerserPlugin from 'terser-webpack-plugin';

const nextConfig = {  
  transpilePackages: ['@tsed/react-formio', '@tsed/tailwind-formio'],
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

    // Handle ESM modules
    config.module.rules.push({
      test: /\.m?js$/,
      type: 'javascript/auto',
      resolve: {
        fullySpecified: false,
      },
    });

    return config;
  },
};

export default nextConfig;
