export type EnvironmentVariableClassification =
  | 'public'
  | 'vercel-system'
  | 'runtime'
  | 'secret'
  | 'configuration';

export type MigrationRequirement =
  | 'REPLICABLE_FROM_EXPORT'
  | 'REQUIRES_SECRET_RECOVERY'
  | 'REQUIRES_PLATFORM_CONTROL_PLANE'
  | 'OBSERVATIONAL_ONLY';

export interface VercelEnvironmentVariableEvidence {
  present: boolean;
  empty: boolean;
  length: number;
  classification: EnvironmentVariableClassification;
  migration: MigrationRequirement;
  redacted: boolean;
  value: string | null;
}

export interface VercelRuntimeEvidence {
  schemaVersion: '1.0';
  type: 'panoramablock-vercel-runtime-evidence';
  generatedAt: string;

  runtime: {
    nodeVersion: string;
    nodeRelease: string;
    platform: NodeJS.Platform;
    architecture: string;
    cwd: string;
    pid: number;
    ppid: number;
    uptimeSeconds: number;
    execPath: string;
    title: string;
    versions: Record<string, string>;
    memoryUsage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      arrayBuffers: number;
    };
  };

  vercel: {
    detected: boolean;
    systemEnvironment: Record<
      string,
      VercelEnvironmentVariableEvidence
    >;
  };

  environment: {
    variableCount: number;
    variables: Record<
      string,
      VercelEnvironmentVariableEvidence
    >;
  };

  limitations: string[];
}

const SECRET_NAME_PATTERN =
  /(^|_)(SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|PRIVATEKEY|PRIVATE_KEY|API_KEY|APIKEY|AUTH|AUTHORIZATION|COOKIE|SESSION|CREDENTIAL|CREDENTIALS|CLIENT_SECRET|SIGNING_KEY|ENCRYPTION_KEY|DATABASE_URL|DB_URL|CONNECTION_STRING)($|_)/i;

function isExplicitlyPublicName(name: string): boolean {
  return (
    name.startsWith('NEXT_PUBLIC_') ||
    name === 'NODE_ENV'
  );
}

function isVercelSystemName(name: string): boolean {
  return (
    name === 'VERCEL' ||
    name.startsWith('VERCEL_')
  );
}

function classifyEnvironmentVariable(
  name: string
): EnvironmentVariableClassification {
  if (SECRET_NAME_PATTERN.test(name)) {
    return 'secret';
  }

  if (isExplicitlyPublicName(name)) {
    return 'public';
  }

  if (isVercelSystemName(name)) {
    return 'vercel-system';
  }

  if (
    name === 'NODE_ENV' ||
    name === 'TZ' ||
    name === 'LANG'
  ) {
    return 'runtime';
  }

  return 'configuration';
}

function migrationRequirement(
  classification: EnvironmentVariableClassification
): MigrationRequirement {
  if (classification === 'secret') {
    return 'REQUIRES_SECRET_RECOVERY';
  }

  if (classification === 'vercel-system') {
    return 'REQUIRES_PLATFORM_CONTROL_PLANE';
  }

  if (classification === 'runtime') {
    return 'OBSERVATIONAL_ONLY';
  }

  return 'REPLICABLE_FROM_EXPORT';
}

function mayExposeValue(
  name: string,
  classification: EnvironmentVariableClassification
): boolean {
  if (classification === 'secret') {
    return false;
  }

  if (classification === 'public') {
    return true;
  }

  if (classification === 'vercel-system') {
    return true;
  }

  if (
    name === 'NODE_ENV' ||
    name === 'TZ' ||
    name === 'LANG'
  ) {
    return true;
  }

  return false;
}

function describeEnvironmentVariable(
  name: string,
  value: string | undefined
): VercelEnvironmentVariableEvidence {
  const present = value !== undefined;
  const actualValue = value ?? '';
  const classification = classifyEnvironmentVariable(name);
  const expose = present && mayExposeValue(name, classification);

  return {
    present,
    empty: present && actualValue.length === 0,
    length: present ? actualValue.length : 0,
    classification,
    migration: migrationRequirement(classification),
    redacted: present && !expose,
    value: expose ? actualValue : null,
  };
}

function collectEnvironment(
  environment: NodeJS.ProcessEnv
): Record<string, VercelEnvironmentVariableEvidence> {
  const result: Record<string, VercelEnvironmentVariableEvidence> = {};

  for (const name of Object.keys(environment).sort()) {
    result[name] = describeEnvironmentVariable(
      name,
      environment[name]
    );
  }

  return result;
}

export function collectVercelRuntimeEvidence(
  environment: NodeJS.ProcessEnv = process.env
): VercelRuntimeEvidence {
  const variables = collectEnvironment(environment);

  const systemEnvironment: Record<
    string,
    VercelEnvironmentVariableEvidence
  > = {};

  for (const [name, evidence] of Object.entries(variables)) {
    if (isVercelSystemName(name)) {
      systemEnvironment[name] = evidence;
    }
  }

  const memory = process.memoryUsage();

  return {
    schemaVersion: '1.0',
    type: 'panoramablock-vercel-runtime-evidence',
    generatedAt: new Date().toISOString(),

    runtime: {
      nodeVersion: process.version,
      nodeRelease: process.release.name,
      platform: process.platform,
      architecture: process.arch,
      cwd: process.cwd(),
      pid: process.pid,
      ppid: process.ppid,
      uptimeSeconds: process.uptime(),
      execPath: process.execPath,
      title: process.title,
      versions: { ...process.versions },
      memoryUsage: {
        rss: memory.rss,
        heapTotal: memory.heapTotal,
        heapUsed: memory.heapUsed,
        external: memory.external,
        arrayBuffers: memory.arrayBuffers,
      },
    },

    vercel: {
      detected:
        environment.VERCEL === '1' ||
        Object.keys(systemEnvironment).length > 0,
      systemEnvironment,
    },

    environment: {
      variableCount: Object.keys(variables).length,
      variables,
    },

    limitations: [
      'This evidence contains only information visible to the running application process.',
      'Secret and unclassified configuration values are intentionally redacted.',
      'Vercel account, team, billing, project-control-plane, domain and integration settings are not enumerable from process.env unless Vercel exposes them to this runtime.',
      'Redacted values must be recovered or rotated separately before replication.',
    ],
  };
}
