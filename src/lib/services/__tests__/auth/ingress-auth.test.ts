import { describe, it, expect, afterEach } from "vitest";
import { hasAdminGate } from "../../auth/ingress-auth";
import { _reloadEnvForTest } from "@/lib/env";

const ADMIN_GATE_HEADER = "x-admin-gate";

function makeRequest(gate?: string): Request {
  const headers: Record<string, string> = {};
  if (gate !== undefined) headers[ADMIN_GATE_HEADER] = gate;
  return new Request("http://localhost/backstage", { headers });
}

function configure(opts: { backstageOpen?: string; secret?: string }): void {
  if (opts.backstageOpen === undefined) delete process.env.BACKSTAGE_OPEN;
  else process.env.BACKSTAGE_OPEN = opts.backstageOpen;
  if (opts.secret === undefined) delete process.env.ADMIN_GATE_SECRET;
  else process.env.ADMIN_GATE_SECRET = opts.secret;
  _reloadEnvForTest();
}

afterEach(() => {
  delete process.env.BACKSTAGE_OPEN;
  delete process.env.ADMIN_GATE_SECRET;
  _reloadEnvForTest();
});

describe("hasAdminGate", () => {
  it("allows any request when BACKSTAGE_OPEN is set", () => {
    configure({ backstageOpen: "1" });
    expect(hasAdminGate(makeRequest())).toBe(true);
  });

  it("denies when neither BACKSTAGE_OPEN nor ADMIN_GATE_SECRET is configured", () => {
    configure({});
    expect(hasAdminGate(makeRequest("anything"))).toBe(false);
  });

  it("allows when the header matches the configured secret", () => {
    configure({ secret: "s3cr3t" });
    expect(hasAdminGate(makeRequest("s3cr3t"))).toBe(true);
  });

  it("denies when the header does not match the configured secret", () => {
    configure({ secret: "s3cr3t" });
    expect(hasAdminGate(makeRequest("wrong"))).toBe(false);
  });

  it("denies when the header is absent", () => {
    configure({ secret: "s3cr3t" });
    expect(hasAdminGate(makeRequest())).toBe(false);
  });
});
