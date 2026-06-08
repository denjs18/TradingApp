/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Évite les conflits avec l'API Python
  async rewrites() {
    const apiBase = process.env.PYTHON_API_URL || "http://localhost:5000";
    if (process.env.NODE_ENV === "development") {
      return [
        {
          source: "/api/:path*",
          destination: `${apiBase}/api/:path*`,
        },
      ];
    }
    return [];
  },
};

module.exports = nextConfig;
