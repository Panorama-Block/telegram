import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { parseEnv } from '../env.js';

// How long the gateway caches the aggregated _discovery response (ms).
const DISCOVERY_CACHE_TTL_MS = 30_000;

// RFC 8594 Sunset date for legacy /swap/* routes — 90 days from sprint start.
export const LEGACY_DEPRECATION_DATE = 'Mon, 24 Aug 2026 00:00:00 GMT';

// -------------------------------------------------------------------------------------------------
// Local types — mirrors shared/capability/availability.types.ts shapes over the wire.
// -------------------------------------------------------------------------------------------------

interface ProviderAvailability {
  provider: string;
  healthy: boolean;
  latencyP95Ms?: number;
  lastError?: string;
  lastCheckedAt?: string;
}

interface CapabilityAvailability {
  capability: string;
  byChain: Record<number, ProviderAvailability[]>;
}

interface AvailabilityMap {
  capabilities: CapabilityAvailability[];
  generatedAt: string;
  cacheTtlSeconds: number;
}

interface ServiceConfig {
  name: string;
  url: string;
}

// -------------------------------------------------------------------------------------------------
// Module-level discovery cache (singleton per process).
// -------------------------------------------------------------------------------------------------

let discoveryCache: { data: unknown; ts: number } | null = null;

// -------------------------------------------------------------------------------------------------
// Proxy helper
// -------------------------------------------------------------------------------------------------

async function proxyCapabilityRequest(
  targetUrl: string,
  req: FastifyRequest,
  reply: FastifyReply,
  serviceName: string,
): Promise<unknown> {
  try {
    // Flatten multi-value headers to single strings for fetch.
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers[k] = v;
      else if (Array.isArray(v) && v[0]) headers[k] = v[0];
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });

    const contentType = response.headers.get('content-type');
    if (contentType) reply.header('content-type', contentType);
    reply.code(response.status);
    return reply.send(await response.json());
  } catch (err) {
    req.log.error({ err, url: targetUrl }, `[capability/${serviceName}] proxy failed`);
    return reply.code(502).send({
      status: 'error',
      error: {
        code: `${serviceName.toUpperCase()}_UNAVAILABLE`,
        category: 'unavailable',
        message: `${serviceName} capability service is unavailable`,
        httpStatus: 502,
      },
      traceId: String(req.id),
      latencyMs: 0,
    });
  }
}

// -------------------------------------------------------------------------------------------------
// Discovery aggregation helpers
// -------------------------------------------------------------------------------------------------

function mergeAvailabilityMaps(maps: AvailabilityMap[]): AvailabilityMap {
  // capability slug → chainId → providers (dedup by provider name)
  const byCapability = new Map<string, Map<number, ProviderAvailability[]>>();

  for (const map of maps) {
    for (const cap of map.capabilities) {
      const chainMap = byCapability.get(cap.capability) ?? new Map<number, ProviderAvailability[]>();
      byCapability.set(cap.capability, chainMap);

      for (const [chainIdStr, providers] of Object.entries(cap.byChain)) {
        const chainId = Number(chainIdStr);
        const existing = chainMap.get(chainId) ?? [];
        const seen = new Set(existing.map((p) => p.provider));
        for (const p of providers) {
          if (!seen.has(p.provider)) {
            existing.push(p);
            seen.add(p.provider);
          }
        }
        chainMap.set(chainId, existing);
      }
    }
  }

  // Materialise: capabilities alphabetically, chains numerically, providers alphabetically.
  const capabilities: CapabilityAvailability[] = [];
  for (const [capability, chainMap] of [...byCapability.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const byChain: Record<number, ProviderAvailability[]> = {};
    for (const [chainId, providers] of [...chainMap.entries()].sort(([a], [b]) => a - b)) {
      byChain[chainId] = [...providers].sort((a, b) => a.provider.localeCompare(b.provider));
    }
    capabilities.push({ capability, byChain });
  }

  return {
    capabilities,
    generatedAt: new Date().toISOString(),
    cacheTtlSeconds: Math.floor(DISCOVERY_CACHE_TTL_MS / 1000),
  };
}

// -------------------------------------------------------------------------------------------------
// Route registration
// -------------------------------------------------------------------------------------------------

export async function registerCapabilityRoutes(app: FastifyInstance): Promise<void> {
  const env = parseEnv();

  // Order matters: stake uses lido-service as primary; execution-layer handles tx submission
  // internally within lido-service and is not exposed separately at this proxy layer.
  const services: ServiceConfig[] = [
    { name: 'swap',   url: env.SWAP_API_BASE },
    { name: 'bridge', url: env.BRIDGE_API_BASE },
    { name: 'stake',  url: env.LIDO_API_BASE },
    { name: 'lend',   url: env.LENDING_API_BASE },
    { name: 'dca',    url: env.DCA_API_BASE },
    ...(env.AUTH_API_BASE ? [{ name: 'auth', url: env.AUTH_API_BASE }] : []),
  ];

  // /v1/capability/<slug>/* → upstream service preserving full path + query
  for (const { name, url } of services) {
    app.all(`/v1/capability/${name}/*`, async (req, reply) => {
      const targetUrl = `${url}${req.url}`;
      app.log.info({ targetUrl }, `[Gateway] → capability/${name}`);
      return proxyCapabilityRequest(targetUrl, req, reply, name);
    });
  }

  // /v1/capability/_discovery → aggregate all upstream _discovery endpoints
  app.get('/v1/capability/_discovery', async (req, reply) => {
    const startMs = Date.now();
    const force = (req.query as Record<string, string>)['force'] === 'true';

    if (!force && discoveryCache && startMs - discoveryCache.ts < DISCOVERY_CACHE_TTL_MS) {
      reply.header('x-cache', 'HIT');
      reply.header('cache-control', `public, max-age=${Math.floor(DISCOVERY_CACHE_TTL_MS / 1000)}`);
      return reply.send(discoveryCache.data);
    }

    const results = await Promise.allSettled(
      services.map(async ({ name: svcName, url }) => {
        const probeStart = Date.now();
        const res = await fetch(`${url}/v1/capability/_discovery`, {
          signal: AbortSignal.timeout(5_000),
        });
        const json = (await res.json()) as { status: string; data: AvailabilityMap };
        return { service: svcName, map: json.data, latencyMs: Date.now() - probeStart };
      }),
    );

    const maps: AvailabilityMap[] = [];
    const serviceStatuses: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

    for (let i = 0; i < results.length; i++) {
      const { name: svcName } = services[i]!;
      const result = results[i]!;
      if (result.status === 'fulfilled') {
        serviceStatuses[svcName] = { ok: true, latencyMs: result.value.latencyMs };
        if (result.value.map) maps.push(result.value.map);
      } else {
        serviceStatuses[svcName] = { ok: false, error: String(result.reason) };
        app.log.warn({ svcName, err: result.reason }, '[discovery] upstream unreachable');
      }
    }

    const merged = mergeAvailabilityMaps(maps);
    const payload = {
      status: 'success',
      data: {
        ...merged,
        serviceStatuses,
      },
      provider: { name: 'gateway-aggregator' },
      traceId: String(req.id),
      latencyMs: Date.now() - startMs,
    };

    discoveryCache = { data: payload, ts: startMs };
    reply.header('x-cache', 'MISS');
    reply.header('cache-control', `public, max-age=${Math.floor(DISCOVERY_CACHE_TTL_MS / 1000)}`);
    return reply.send(payload);
  });

  app.log.info(
    { routes: services.map((s) => `/v1/capability/${s.name}/*`).concat(['/v1/capability/_discovery']) },
    'Capability routes registered',
  );
}
