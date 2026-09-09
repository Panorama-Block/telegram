import { describe, expect, it } from 'vitest';
import { collectVercelRuntimeEvidence } from './vercelRuntimeEvidence';

describe('Vercel runtime evidence', () => {
  it('enumerates every supplied environment variable key', () => {
    const environment: NodeJS.ProcessEnv = {
      NEXT_PUBLIC_GATEWAY_URL: 'https://api.panoramablock.com',
      VERCEL: '1',
      VERCEL_ENV: 'production',
      INTERNAL_FEATURE_FLAG: 'enabled',
      DB_GATEWAY_TOKEN: 'super-secret-database-token',
    };

    const evidence = collectVercelRuntimeEvidence(environment);

    expect(Object.keys(evidence.environment.variables)).toEqual([
      'DB_GATEWAY_TOKEN',
      'INTERNAL_FEATURE_FLAG',
      'NEXT_PUBLIC_GATEWAY_URL',
      'VERCEL',
      'VERCEL_ENV',
    ]);

    expect(evidence.environment.variableCount).toBe(5);
  });

  it('exposes explicitly public configuration values', () => {
    const evidence = collectVercelRuntimeEvidence({
      NEXT_PUBLIC_AGENTS_API_BASE:
        'https://colettogs-zico-agent.hf.space',
      NEXT_PUBLIC_GATEWAY_URL:
        'https://api.panoramablock.com',
    });

    expect(
      evidence.environment.variables.NEXT_PUBLIC_AGENTS_API_BASE
    ).toEqual({
      present: true,
      empty: false,
      length: 37,
      classification: 'public',
      migration: 'REPLICABLE_FROM_EXPORT',
      redacted: false,
      value: 'https://colettogs-zico-agent.hf.space',
    });

    expect(
      evidence.environment.variables.NEXT_PUBLIC_GATEWAY_URL.value
    ).toBe('https://api.panoramablock.com');
  });

  it('exposes Vercel system metadata supplied to the runtime', () => {
    const evidence = collectVercelRuntimeEvidence({
      VERCEL: '1',
      VERCEL_ENV: 'production',
      VERCEL_REGION: 'iad1',
      VERCEL_GIT_COMMIT_SHA: 'abc123',
    });

    expect(evidence.vercel.detected).toBe(true);

    expect(
      evidence.vercel.systemEnvironment.VERCEL_ENV
    ).toEqual({
      present: true,
      empty: false,
      length: 10,
      classification: 'vercel-system',
      migration: 'REQUIRES_PLATFORM_CONTROL_PLANE',
      redacted: false,
      value: 'production',
    });

    expect(
      evidence.vercel.systemEnvironment.VERCEL_REGION.value
    ).toBe('iad1');

    expect(
      evidence.vercel.systemEnvironment.VERCEL_GIT_COMMIT_SHA.value
    ).toBe('abc123');
  });

  it('redacts recognised secret values but preserves replication metadata', () => {
    const secret = 'this-value-must-never-be-exported';

    const evidence = collectVercelRuntimeEvidence({
      DB_GATEWAY_TOKEN: secret,
      GOOGLE_CLIENT_SECRET: secret,
      DATABASE_URL: secret,
      SIGNING_KEY: secret,
    });

    for (const name of [
      'DB_GATEWAY_TOKEN',
      'GOOGLE_CLIENT_SECRET',
      'DATABASE_URL',
      'SIGNING_KEY',
    ]) {
      const variable = evidence.environment.variables[name];

      expect(variable.present).toBe(true);
      expect(variable.empty).toBe(false);
      expect(variable.length).toBe(secret.length);
      expect(variable.classification).toBe('secret');
      expect(variable.migration).toBe(
        'REQUIRES_SECRET_RECOVERY'
      );
      expect(variable.redacted).toBe(true);
      expect(variable.value).toBeNull();
    }

    expect(JSON.stringify(evidence)).not.toContain(secret);
  });

  it('redacts unclassified configuration values by default', () => {
    const value = 'internal-value-that-is-not-proven-safe';

    const evidence = collectVercelRuntimeEvidence({
      INTERNAL_FEATURE_FLAG: value,
    });

    expect(
      evidence.environment.variables.INTERNAL_FEATURE_FLAG
    ).toEqual({
      present: true,
      empty: false,
      length: value.length,
      classification: 'configuration',
      migration: 'REPLICABLE_FROM_EXPORT',
      redacted: true,
      value: null,
    });

    expect(JSON.stringify(evidence)).not.toContain(value);
  });

  it('records empty variables without inventing a value', () => {
    const evidence = collectVercelRuntimeEvidence({
      NEXT_PUBLIC_EMPTY_SETTING: '',
    });

    expect(
      evidence.environment.variables.NEXT_PUBLIC_EMPTY_SETTING
    ).toEqual({
      present: true,
      empty: true,
      length: 0,
      classification: 'public',
      migration: 'REPLICABLE_FROM_EXPORT',
      redacted: false,
      value: '',
    });
  });

  it('captures runtime metadata independently from environment values', () => {
    const evidence = collectVercelRuntimeEvidence({
      VERCEL: '1',
    });

    expect(evidence.schemaVersion).toBe('1.0');
    expect(evidence.type).toBe(
      'panoramablock-vercel-runtime-evidence'
    );

    expect(evidence.runtime.nodeVersion).toBe(process.version);
    expect(evidence.runtime.platform).toBe(process.platform);
    expect(evidence.runtime.architecture).toBe(process.arch);
    expect(evidence.runtime.cwd).toBe(process.cwd());

    expect(evidence.runtime.memoryUsage.rss).toBeGreaterThan(0);
    expect(evidence.generatedAt).toEqual(expect.any(String));
  });

  it('does not report Vercel when no Vercel runtime variables exist', () => {
    const evidence = collectVercelRuntimeEvidence({
      NODE_ENV: 'production',
    });

    expect(evidence.vercel.detected).toBe(false);
    expect(evidence.vercel.systemEnvironment).toEqual({});
  });
});
