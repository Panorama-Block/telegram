export interface RuntimeProbeResult {
  url: string;
  reachable: boolean;
  status: number | null;
  ok: boolean | null;
  latencyMs: number;
  response: {
    contentType: string | null;
    server: string | null;
    vercelId: string | null;
  } | null;
  error: string | null;
}

export interface ZicoRuntimeEvidenceProbeResult extends RuntimeProbeResult {
  evidence: Record<string, unknown> | null;
}

export interface RuntimeDiagnostics {
  schemaVersion: '1.0';
  type: 'panoramablock-runtime-diagnostics';
  generatedAt: string;

  client: {
    origin: string;
    hostname: string;
    protocol: string;
    pathname: string;
    nodeEnv: string | null;
    userAgent: string;
    language: string;
    online: boolean;
    serviceWorker: {
      supported: boolean;
      controlled: boolean;
      scriptOrigin: string | null;
      scriptPathname: string | null;
    };
  };

  buildVisibleConfiguration: {
    nextPublicGatewayUrl: string | null;
    nextPublicYieldApiUrl: string | null;
    nextPublicLendingApiUrl: string | null;
    nextPublicStakingApiUrl: string | null;
    nextPublicSwapApiBase: string | null;
    nextPublicBridgeApiBase: string | null;
    nextPublicThirdwebClientId: string | null;
    nextPublicWalletConnectProjectId: string | null;
    nextPublicWcProjectId: string | null;
    nextPublicVercelUrl: string | null;
    nextPublicVercelEnvironment: string | null;
    nextPublicVercelGitCommitSha: string | null;
  };

  clientContracts: {
    gateway: '/api/gateway';
    yield: '/api/yield';
    lending: '/api/lending';
    staking: '/api/staking';
    swap: '/api/swap';
    dca: '/api/dca';
  };

  administrator: {
    verified: boolean;
    walletAddress: string;
  };

  probes: {
    deployedGatewayProxy: RuntimeProbeResult;
    panoramaControlledGateway: RuntimeProbeResult;
    zicoRuntimeEvidence: ZicoRuntimeEvidenceProbeResult;
  };
}

function publicValue(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function safeUrlParts(value: string | null | undefined): {
  origin: string | null;
  pathname: string | null;
} {
  if (!value) {
    return { origin: null, pathname: null };
  }

  try {
    const parsed = new URL(value);
    return {
      origin: parsed.origin,
      pathname: parsed.pathname,
    };
  } catch {
    return {
      origin: null,
      pathname: null,
    };
  }
}

async function probe(
  url: string,
  options?: RequestInit
): Promise<RuntimeProbeResult> {
  const started = performance.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      ...options,
    });

    return {
      url,
      reachable: true,
      status: response.status,
      ok: response.ok,
      latencyMs: Math.round(performance.now() - started),
      response: {
        contentType: response.headers.get('content-type'),
        server: response.headers.get('server'),
        vercelId: response.headers.get('x-vercel-id'),
      },
      error: null,
    };
  } catch (error) {
    return {
      url,
      reachable: false,
      status: null,
      ok: null,
      latencyMs: Math.round(performance.now() - started),
      response: null,
      error: error instanceof Error ? error.name : 'UnknownError',
    };
  }
}


function agentsApiBase(): string | null {
  return (
    publicValue(process.env.NEXT_PUBLIC_AGENTS_API_BASE) ||
    publicValue(process.env.VITE_AGENTS_API_BASE) ||
    publicValue(process.env.AGENTS_API_BASE)
  );
}

async function probeZicoRuntimeEvidence(): Promise<ZicoRuntimeEvidenceProbeResult> {
  const baseUrl = agentsApiBase();
  const authToken =
    typeof window !== 'undefined'
      ? localStorage.getItem('authToken')
      : null;

  if (!baseUrl) {
    return {
      url: '',
      reachable: false,
      status: null,
      ok: null,
      latencyMs: 0,
      response: null,
      evidence: null,
      error: 'AGENTS_API_BASE not configured',
    };
  }

  const url =
    `${baseUrl.replace(/\/+$/, '')}/__runtime_evidence`;

  if (!authToken) {
    return {
      url,
      reachable: false,
      status: null,
      ok: null,
      latencyMs: 0,
      response: null,
      evidence: null,
      error: 'Panorama authentication token unavailable',
    };
  }

  const started = performance.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    let evidence: Record<string, unknown> | null = null;

    if (response.ok) {
      try {
        const body = await response.json();
        if (
          body !== null &&
          typeof body === 'object' &&
          !Array.isArray(body)
        ) {
          evidence = body as Record<string, unknown>;
        }
      } catch {
        evidence = null;
      }
    }

    let error: string | null = null;

    if (response.status === 401) {
      error = 'Zico runtime evidence authentication failed';
    } else if (response.status === 503) {
      error =
        'Zico runtime evidence authentication service unavailable';
    } else if (!response.ok) {
      error =
        `Zico runtime evidence request failed with HTTP ${response.status}`;
    }

    return {
      url,
      reachable: true,
      status: response.status,
      ok: response.ok,
      latencyMs: Math.round(performance.now() - started),
      response: {
        contentType: response.headers.get('content-type'),
        server: response.headers.get('server'),
        vercelId: response.headers.get('x-vercel-id'),
      },
      evidence,
      error,
    };
  } catch (error) {
    return {
      url,
      reachable: false,
      status: null,
      ok: null,
      latencyMs: Math.round(performance.now() - started),
      response: null,
      evidence: null,
      error: error instanceof Error ? error.name : 'UnknownError',
    };
  }
}

export async function collectRuntimeDiagnostics(args: {
  walletAddress: string;
  verifiedAdmin: boolean;
}): Promise<RuntimeDiagnostics> {
  if (typeof window === 'undefined') {
    throw new Error('Runtime diagnostics can only be collected in the browser.');
  }

  if (!args.verifiedAdmin) {
    throw new Error('Verified administrator capability is required.');
  }

  const serviceWorkerSupported = 'serviceWorker' in navigator;
  const controller = serviceWorkerSupported
    ? navigator.serviceWorker.controller
    : null;

  const serviceWorkerUrl = safeUrlParts(controller?.scriptURL);

  const [
    deployedGatewayProxy,
    panoramaControlledGateway,
    zicoRuntimeEvidence,
  ] = await Promise.all([
    probe('/api/gateway/v1/user-profiles?take=1', {
      headers: {
        'x-tenant-id': 'panorama',
      },
    }),
    probe(
      'https://api.panoramablock.com/database/v1/user-profiles?take=1',
      {
        headers: {
          'x-tenant-id': 'panorama',
        },
      }
    ),
    probeZicoRuntimeEvidence(),
  ]);

  return {
    schemaVersion: '1.0',
    type: 'panoramablock-runtime-diagnostics',
    generatedAt: new Date().toISOString(),

    client: {
      origin: window.location.origin,
      hostname: window.location.hostname,
      protocol: window.location.protocol,
      pathname: window.location.pathname,
      nodeEnv: publicValue(process.env.NODE_ENV),
      userAgent: navigator.userAgent,
      language: navigator.language,
      online: navigator.onLine,
      serviceWorker: {
        supported: serviceWorkerSupported,
        controlled: controller !== null,
        scriptOrigin: serviceWorkerUrl.origin,
        scriptPathname: serviceWorkerUrl.pathname,
      },
    },

    buildVisibleConfiguration: {
      nextPublicGatewayUrl:
        publicValue(process.env.NEXT_PUBLIC_GATEWAY_URL),
      nextPublicYieldApiUrl:
        publicValue(process.env.NEXT_PUBLIC_YIELD_API_URL),
      nextPublicLendingApiUrl:
        publicValue(process.env.NEXT_PUBLIC_LENDING_API_URL),
      nextPublicStakingApiUrl:
        publicValue(process.env.NEXT_PUBLIC_STAKING_API_URL),
      nextPublicSwapApiBase:
        publicValue(process.env.NEXT_PUBLIC_SWAP_API_BASE),
      nextPublicBridgeApiBase:
        publicValue(process.env.NEXT_PUBLIC_BRIDGE_API_BASE),
      nextPublicThirdwebClientId:
        publicValue(process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID),
      nextPublicWalletConnectProjectId:
        publicValue(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID),
      nextPublicWcProjectId:
        publicValue(process.env.NEXT_PUBLIC_WC_PROJECT_ID),
      nextPublicVercelUrl:
        publicValue(process.env.NEXT_PUBLIC_VERCEL_URL),
      nextPublicVercelEnvironment:
        publicValue(process.env.NEXT_PUBLIC_VERCEL_ENV),
      nextPublicVercelGitCommitSha:
        publicValue(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA),
    },

    clientContracts: {
      gateway: '/api/gateway',
      yield: '/api/yield',
      lending: '/api/lending',
      staking: '/api/staking',
      swap: '/api/swap',
      dca: '/api/dca',
    },

    administrator: {
      verified: true,
      walletAddress: args.walletAddress.toLowerCase(),
    },

    probes: {
      deployedGatewayProxy,
      panoramaControlledGateway,
      zicoRuntimeEvidence,
    },
  };
}

export function downloadRuntimeDiagnostics(
  diagnostics: RuntimeDiagnostics
): void {
  const timestamp = diagnostics.generatedAt
    .replace(/[:.]/g, '-');

  const filename =
    `panoramablock-runtime-diagnostics-${timestamp}.json`;

  const blob = new Blob(
    [JSON.stringify(diagnostics, null, 2) + '\n'],
    { type: 'application/json' }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
