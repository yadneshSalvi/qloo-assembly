import { describe, expect, it } from "vitest";
import type { ConnectionOptions, PeerCertificate } from "node:tls";
import { databasePoolConfiguration } from "../packages/domain/src/database";

const certificate = {
  subject: { CN: "database.example" },
  subjectaltname: "DNS:database.example",
} as PeerCertificate;
const uniqueCa = "synthetic-instance-unique-ca";
const env = {
  DATABASE_URL:
    "postgresql://operator:private@10.0.0.1/assembly?sslmode=no-verify&sslrootcert=other-ca",
  DATABASE_SSL_CA_FILE: "/secrets/sql-ca.pem",
};

describe("explicit database TLS verification modes", () => {
  it("retains pinned-CA and hostname verification by default", () => {
    const config = databasePoolConfiguration(env, () => uniqueCa);
    const ssl = config.ssl as ConnectionOptions;
    expect(ssl.ca).toBe(uniqueCa);
    expect(ssl.rejectUnauthorized).toBe(true);
    expect(
      ssl.checkServerIdentity!("different.example", certificate),
    ).toBeInstanceOf(Error);
    expect(
      ssl.checkServerIdentity!("database.example", certificate),
    ).toBeUndefined();
    expect(config.connectionString).not.toContain("sslmode");
    expect(config.connectionString).not.toContain("sslrootcert");
  });

  it("skips only hostname comparison when verify-ca is explicitly selected", () => {
    const config = databasePoolConfiguration(
      { ...env, DATABASE_SSL_MODE: "verify-ca" },
      () => uniqueCa,
    );
    const ssl = config.ssl as ConnectionOptions;
    expect(ssl.ca).toBe(uniqueCa);
    expect(ssl.rejectUnauthorized).toBe(true);
    expect(ssl.checkServerIdentity!("10.0.0.1", certificate)).toBeUndefined();
  });

  it("rejects missing/empty CA and unrecognized verification modes", () => {
    expect(() =>
      databasePoolConfiguration({ DATABASE_SSL_MODE: "verify-ca" }),
    ).toThrow("requires DATABASE_SSL_CA_FILE");
    expect(() =>
      databasePoolConfiguration(
        { ...env, DATABASE_SSL_MODE: "disable" },
        () => uniqueCa,
      ),
    ).toThrow("verify-full or verify-ca");
    expect(() => databasePoolConfiguration(env, () => "")).toThrow(
      "CA file is empty",
    );
  });

  it("preserves local connection behavior and bounds pool size", () => {
    const config = databasePoolConfiguration({
      DATABASE_URL: "postgresql://localhost/assembly",
      DATABASE_POOL_MAX: "999",
    });
    expect(config.ssl).toBeUndefined();
    expect(config.max).toBe(20);
    expect(databasePoolConfiguration({ DATABASE_POOL_MAX: "-1" }).max).toBe(1);
  });
});
