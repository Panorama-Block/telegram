import { describe, it, expect } from 'vitest';

import { getGatewayHello } from '../src/index';

describe('gateway scaffold', () => {
  it('returns hello string', () => {
    expect(getGatewayHello()).toContain('scaffold ok');
  });
});


