import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin the trace root to this project. A lockfile in a parent directory would
  // otherwise be selected as the workspace root and widen the build trace.
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
