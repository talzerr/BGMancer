/**
 * Admin gate for /backstage.
 *
 * The real authorization policy lives at the ingress (Traefik BasicAuth or
 * forwardAuth), which injects `x-admin-gate` on requests it has authenticated.
 * This is a presence-and-match check behind it, not a standalone auth system.
 *
 * On a LAN-only deployment the network is the boundary and BACKSTAGE_OPEN=1
 * opens the gate. Fails closed when neither is configured.
 */
import { env } from "@/lib/env";

const ADMIN_GATE_HEADER = "x-admin-gate";

export function hasAdminGate(request: Request): boolean {
  if (env.backstageOpen) return true;
  const secret = env.adminGateSecret;
  if (!secret) return false;
  return request.headers.get(ADMIN_GATE_HEADER) === secret;
}
