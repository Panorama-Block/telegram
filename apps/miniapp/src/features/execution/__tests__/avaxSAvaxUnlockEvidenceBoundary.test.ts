import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const componentSource = fs.readFileSync(
  path.join(
    root,
    'src/components/AvaxLiquidStaking.tsx'
  ),
  'utf8'
);

const apiSource = fs.readFileSync(
  path.join(
    root,
    'src/features/staking/avaxStakingApi.ts'
  ),
  'utf8'
);

describe(
  'Avalanche sAVAX request unlock evidence boundary',
  () => {
    it(
      'preserves the complete prepared unlock bundle instead of returning only step zero',
      () => {
        const unlockMethodStart =
          apiSource.indexOf(
            'async prepareRequestUnlock('
          );

        const redeemMethodStart =
          apiSource.indexOf(
            'async prepareRedeem(',
            unlockMethodStart
          );

        expect(
          unlockMethodStart
        ).toBeGreaterThan(-1);

        expect(
          redeemMethodStart
        ).toBeGreaterThan(
          unlockMethodStart
        );

        const unlockMethod =
          apiSource.slice(
            unlockMethodStart,
            redeemMethodStart
          );

        expect(unlockMethod).toContain(
          'AvaxUnlockPreparedOperation'
        );

        expect(unlockMethod).not.toContain(
          'return steps[0] ?? null'
        );
      }
    );

    it(
      'routes request unlock through the generic evidence executor before wallet signing',
      () => {
        const unlockHandlerStart =
          componentSource.indexOf(
            'const handleRequestUnlock = useCallback'
          );

        const redeemHandlerStart =
          componentSource.indexOf(
            'const handleRedeem = useCallback',
            unlockHandlerStart
          );

        expect(
          unlockHandlerStart
        ).toBeGreaterThan(-1);

        expect(
          redeemHandlerStart
        ).toBeGreaterThan(
          unlockHandlerStart
        );

        const unlockHandler =
          componentSource.slice(
            unlockHandlerStart,
            redeemHandlerStart
          );

        expect(unlockHandler).toContain(
          'prepared.correlationId'
        );

        expect(unlockHandler).toContain(
          'prepared.evidenceEnabled'
        );

        expect(unlockHandler).toContain(
          'prepared.preparedPayloadHash'
        );

        expect(unlockHandler).toContain(
          'executeEvidenceBoundOperation'
        );

        expect(unlockHandler).toContain(
          'submitEvidence'
        );

        expect(unlockHandler).not.toContain(
          'await executeTx(tx)'
        );
      }
    );
  }
);
