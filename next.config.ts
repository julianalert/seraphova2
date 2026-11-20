import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The city list is read from disk at runtime, so tell the tracer to ship it.
  outputFileTracingIncludes: {
    "/api/cities": ["./data/cities.json"],
  },
};

export default nextConfig;
