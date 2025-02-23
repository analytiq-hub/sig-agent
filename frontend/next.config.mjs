/** @type {import('next').NextConfig} */
//import { withPlugins } from 'next-compose-plugins';
import TerserPlugin from 'terser-webpack-plugin';

const nextConfig = {  
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
