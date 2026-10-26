import { readFileSync } from "node:fs";
import { checkServerIdentity } from "node:tls";
import type { PoolConfig } from "pg";

/** Explicit CA-only mode retains chain verification against the mounted, pinned CA. */
export function databasePoolConfiguration(
  env: Record<string, string | undefined> = process.env,
  readCa: (path: string) => string = (path) => readFileSync(path, "utf8"),
): PoolConfig {
  const mode = env.DATABASE_SSL_MODE?.trim() || "verify-full";
  if (mode !== "verify-full" && mode !== "verify-ca")
    throw new Error("DATABASE_SSL_MODE must be verify-full or verify-ca.");
  const caFile = env.DATABASE_SSL_CA_FILE?.trim();
  if (mode === "verify-ca" && !caFile)
    throw new Error(
      "DATABASE_SSL_MODE=verify-ca requires DATABASE_SSL_CA_FILE.",
    );

  let connectionString = env.DATABASE_URL;
  let ssl: PoolConfig["ssl"];
  if (caFile) {
    const ca = readCa(caFile);
    if (!ca.trim())
      throw new Error("The configured database CA file is empty.");
    if (connectionString) {
      const url = new URL(connectionString);
      // pg URL TLS options otherwise override the explicit verification policy.
      for (const key of ["ssl", "sslmode", "sslcert", "sslkey", "sslrootcert"])
        url.searchParams.delete(key);
      connectionString = url.toString();
    }
    ssl = {
      ca,
      rejectUnauthorized: true,
      // Only this explicit deployment mode skips the hostname/SAN comparison.
      // TLS still validates the peer certificate chain against the pinned CA.
      checkServerIdentity:
        mode === "verify-ca" ? () => undefined : checkServerIdentity,
    };
  }
  return {
    connectionString,
    max: Math.min(20, Math.max(1, Number(env.DATABASE_POOL_MAX ?? 8) || 8)),
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    ...(ssl ? { ssl } : {}),
  };
}
