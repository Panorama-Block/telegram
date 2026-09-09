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

export interface SecretMigrationDescriptor {
  secretRef: string;
  valueSource: 'vercel-environment' | 'vercel-system';
  recoveryAction:
    | 'RECOVER_OR_ROTATE_SECRET'
    | 'PLATFORM_GENERATED_DO_NOT_COPY';
}

export interface VercelEnvironmentVariableEvidence {
  present: boolean;
  empty: boolean;
  length: number;
  classification: EnvironmentVariableClassification;
  migration: MigrationRequirement;
  redacted: boolean;
  value: string | null;
  secretMigration?: SecretMigrationDescriptor;
}

export interface VercelRuntimeEvidence {
  schemaVersion: '1.1';
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
  /(^|_)(SECRET|TOKEN|PASSWORD|PASSWD|PRIVATEKEY|PRIVATE_KEY|API_KEY|APIKEY|AUTHORIZATION|COOKIE|SESSION|CREDENTIAL|CREDENTIALS|CLIENT_SECRET|SIGNING_KEY|ENCRYPTION_KEY|DATABASE_URL|DB_URL|CONNECTION_STRING|KEY)($|_)/i;

const PLATFORM_GENERATED_SECRET_NAMES = new Set([
  'VERCEL_DEPLOYMENT_KEY',
]);

const APPLICATION_CONFIGURATION_NAMES = new Set([
  'ADMIN_EMAIL',
  'AGENTS_API_BASE',
  'AGENTS_DEBUG_SHAPE',
  'AGENTS_REQUEST_TIMEOUT_MS',
  'AGENTS_RESPONSE_MESSAGE_PATH',
  'AI_API_URL',
  'AUTH_API_BASE',
  'DCA_API_BASE',
  'DEBUG',
  'DEFAULT_CHAIN_ID',
  'GMAIL_FROM',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REFRESH_TOKEN',
  'GOOGLE_SHEET_ID',
  'MINIAPP_DEBUG_CHAT',
  'NEXT_PUBLIC_AGENTS_API_BASE',
  'NEXT_PUBLIC_AGENTS_REQUEST_TIMEOUT_MS',
  'NEXT_PUBLIC_BASE_EXECUTION_API_URL',
  'NEXT_PUBLIC_BRIDGE_API_BASE',
  'NEXT_PUBLIC_DEMO_MODE',
  'NEXT_PUBLIC_GATEWAY_URL',
  'NEXT_PUBLIC_LENDING_API_URL',
  'NEXT_PUBLIC_MINIAPP_DEBUG_CHAT',
  'NEXT_PUBLIC_STAKING_API_URL',
  'NEXT_PUBLIC_SWAP_API_BASE',
  'NEXT_PUBLIC_THIRDWEB_CLIENT_ID',
  'NEXT_PUBLIC_VERCEL_ENV',
  'NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA',
  'NEXT_PUBLIC_VERCEL_URL',
  'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID',
  'NEXT_PUBLIC_WC_PROJECT_ID',
  'NEXT_PUBLIC_YIELD_API_URL',
  'NODE_ENV',
  'PUBLIC_GATEWAY_URL',
  'PUBLIC_WEBAPP_URL',
  'SWAP_API_BASE',
  'TELEGRAM_BOT_USERNAME',
  'THIRDWEB_CLIENT_ID',
  'TON_TWA_RETURN_URL',
  'VITE_AGENTS_API_BASE',
  'VITE_AUTH_API_BASE',
  'VITE_GATEWAY_BASE',
  'VITE_LENDING_API_BASE',
  'VITE_STAKING_API_URL',
  'VITE_SWAP_API_BASE',
  'VITE_TELEGRAM_BOT_USERNAME',
  'VITE_THIRDWEB_CLIENT_ID',
  'VITE_TON_TWA_RETURN_URL',
  'VITE_YIELD_API_URL',
  'WALLETCONNECT_PROJECT_ID',
  'YIELD_SERVICE_URL',
]);

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
  if (
    PLATFORM_GENERATED_SECRET_NAMES.has(name) ||
    SECRET_NAME_PATTERN.test(name)
  ) {
    return 'secret';
  }

  if (isExplicitlyPublicName(name)) {
    return 'public';
  }

  if (isVercelSystemName(name)) {
    return 'vercel-system';
  }

  if (APPLICATION_CONFIGURATION_NAMES.has(name)) {
    return 'configuration';
  }

  return 'runtime';
}

function migrationRequirement(
  name: string,
  classification: EnvironmentVariableClassification
): MigrationRequirement {
  if (PLATFORM_GENERATED_SECRET_NAMES.has(name)) {
    return 'REQUIRES_PLATFORM_CONTROL_PLANE';
  }

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

  if (classification === 'configuration') {
    return true;
  }

  if (
    classification === 'runtime' &&
    (name === 'TZ' || name === 'LANG')
  ) {
    return true;
  }

  return false;
}

function secretMigrationDescriptor(
  name: string,
  classification: EnvironmentVariableClassification,
  deploymentEnvironment: string
): SecretMigrationDescriptor | undefined {
  if (classification !== 'secret') {
    return undefined;
  }

  if (PLATFORM_GENERATED_SECRET_NAMES.has(name)) {
    return {
      secretRef: `vercel:${deploymentEnvironment}:${name}`,
      valueSource: 'vercel-system',
      recoveryAction: 'PLATFORM_GENERATED_DO_NOT_COPY',
    };
  }

  return {
    secretRef: `vercel:${deploymentEnvironment}:${name}`,
    valueSource: 'vercel-environment',
    recoveryAction: 'RECOVER_OR_ROTATE_SECRET',
  };
}

function describeEnvironmentVariable(
  name: string,
  value: string | undefined,
  deploymentEnvironment: string
): VercelEnvironmentVariableEvidence {
  const present = value !== undefined;
  const actualValue = value ?? '';
  const classification = classifyEnvironmentVariable(name);
  const expose = present && mayExposeValue(name, classification);

  const secretMigration =
    secretMigrationDescriptor(
      name,
      classification,
      deploymentEnvironment
    );

  return {
    present,
    empty: present && actualValue.length === 0,
    length: present ? actualValue.length : 0,
    classification,
    migration: migrationRequirement(
      name,
      classification
    ),
    redacted: present && !expose,
    value: expose ? actualValue : null,
    ...(secretMigration ? { secretMigration } : {}),
  };
}

function collectEnvironment(
  environment: NodeJS.ProcessEnv
): Record<string, VercelEnvironmentVariableEvidence> {
  const result: Record<string, VercelEnvironmentVariableEvidence> = {};

  const deploymentEnvironment =
    environment.VERCEL_TARGET_ENV ||
    environment.VERCEL_ENV ||
    'production';

  for (const name of Object.keys(environment).sort()) {
    result[name] = describeEnvironmentVariable(
      name,
      environment[name],
      deploymentEnvironment
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
    schemaVersion: '1.1',
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
      'Secret values and unknown runtime environment values are intentionally redacted.',
      'Vercel account, team, billing, project-control-plane, domain and integration settings are not enumerable from process.env unless Vercel exposes them to this runtime.',
      'Redacted values must be recovered or rotated separately before replication.',
    ],
  };
}
