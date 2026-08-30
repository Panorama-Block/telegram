import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const componentSource = fs.readFileSync(
  path.join(root, 'src/components/AvaxLiquidStaking.tsx'),
  'utf8'
);

const apiSource = fs.readFileSync(
  path.join(root, 'src/features/staking/avaxStakingApi.ts'),
  'utf8'
);

describe('Avalanche sAVAX stake evidence boundary', () => {
  it('preserves the prepared evidence envelope instead of flattening stake to a bare transaction', () => {
    const stakeMethodStart = apiSource.indexOf('async prepareStake(');
    const unlockMethodStart = apiSource.indexOf(
      'async prepareRequestUnlock(',
      stakeMethodStart
    );

    expect(stakeMethodStart).toBeGreaterThan(-1);
    expect(unlockMethodStart).toBeGreaterThan(stakeMethodStart);

    const stakeMethod = apiSource.slice(
      stakeMethodStart,
      unlockMethodStart
    );

    expect(stakeMethod).toContain(
      'AvaxStakingPreparedOperation'
    );

    expect(stakeMethod).not.toContain(
      'return steps[0] ?? null'
    );
  });

  it('routes AVAX stake through the generic evidence executor before wallet signing', () => {
    const stakeHandlerStart = componentSource.indexOf(
      'const handleStake = useCallback'
    );

    const unlockHandlerStart = componentSource.indexOf(
      'const handleRequestUnlock = useCallback',
      stakeHandlerStart
    );

    expect(stakeHandlerStart).toBeGreaterThan(-1);
    expect(unlockHandlerStart).toBeGreaterThan(stakeHandlerStart);

    const stakeHandler = componentSource.slice(
      stakeHandlerStart,
      unlockHandlerStart
    );

    expect(componentSource).toContain(
      'executeEvidenceBoundOperation'
    );

    expect(stakeHandler).toContain(
      'prepared.correlationId'
    );

    expect(stakeHandler).toContain(
      'prepared.evidenceEnabled'
    );

    expect(stakeHandler).toContain(
      'prepared.preparedPayloadHash'
    );

    expect(stakeHandler).toContain(
      'executeEvidenceBoundOperation'
    );

    expect(stakeHandler).toContain(
      'submitEvidence'
    );

    expect(stakeHandler).not.toContain(
      'await executeTx(tx)'
    );
  });
});
