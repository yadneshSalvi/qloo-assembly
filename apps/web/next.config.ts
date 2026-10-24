import { existsSync } from "node:fs";
import { resolve } from "node:path";
for (const path of [
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), "../../.env.local"),
]) {
  if (existsSync(path)) {
    process.loadEnvFile(path);
    break;
  }
}
import type { NextConfig } from "next";
const config: NextConfig = {
  transpilePackages: [
    "@assembly/contracts",
    "@assembly/domain",
    "@assembly/qloo",
  ],
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
