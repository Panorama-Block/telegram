import {
  describe,
  expect,
  it,
} from 'vitest';

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const componentSource =
  fs.readFileSync(
    path.join(
      root,
      'src/components/AvaxLiquidStaking.tsx'
    ),
    'utf8'
  );

const apiSource =
  fs.readFileSync(
    path.join(
      root,
      'src/features/staking/avaxStakingApi.ts'
    ),
    'utf8'
  );

describe(
  'Avalanche sAVAX redeem evidence boundary',
  () => {
    it(
      'preserves the prepared evidence envelope instead of flattening redeem to a bare transaction',
      () => {
        const redeemMethodStart =
          apiSource.indexOf(
            'async prepareRedeem('
          );

        expect(
          redeemMethodStart
        ).toBeGreaterThan(-1);

        const hookStart =
          apiSource.indexOf(
            'export const useAvaxStakingApi',
            redeemMethodStart
          );

        expect(hookStart)
          .toBeGreaterThan(
            redeemMethodStart
          );

        const redeemMethod =
          apiSource.slice(
            redeemMethodStart,
            hookStart
          );

        expect(redeemMethod)
          .toContain(
            'AvaxRedeemPreparedOperation'
          );

        expect(redeemMethod)
          .not.toContain(
            'return steps[0] ?? null'
          );
      }
    );

    it(
      'routes redeem through the generic evidence executor before wallet signing',
      () => {
        const redeemHandlerStart =
          componentSource.indexOf(
            'const handleRedeem = useCallback'
          );

        const resetStart =
          componentSource.indexOf(
            'const resetTx',
            redeemHandlerStart
          );

        expect(
          redeemHandlerStart
        ).toBeGreaterThan(-1);

        expect(resetStart)
          .toBeGreaterThan(
            redeemHandlerStart
          );

        const redeemHandler =
          componentSource.slice(
            redeemHandlerStart,
            resetStart
          );

        expect(redeemHandler)
          .toContain(
            'prepared.correlationId'
          );

        expect(redeemHandler)
          .toContain(
            'prepared.evidenceEnabled'
          );

        expect(redeemHandler)
          .toContain(
            'prepared.preparedPayloadHash'
          );

        expect(redeemHandler)
          .toContain(
            'executeEvidenceBoundOperation'
          );

        expect(redeemHandler)
          .toContain(
            'submitEvidence'
          );

        expect(redeemHandler)
          .not.toContain(
            'await executeTx(tx)'
          );
      }
    );
  }
);
