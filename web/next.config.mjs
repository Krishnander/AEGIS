/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.node$/,
      use: [{ loader: 'node-loader' }],
    });
    if (!isServer) {
      config.externals = config.externals || [];
      config.externals.push('onnxruntime-node');
    }
    return config;
  },
};

export default nextConfig;
