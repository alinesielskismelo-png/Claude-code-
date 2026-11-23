import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Artefatos grandes (ex.: sala5.html tem ~730 KB) passam pelas rotas de API.
  serverExternalPackages: [],
  poweredByHeader: false,
};

export default nextConfig;
