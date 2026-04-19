/**
 * Canonical token icon map shared across DeFi feature modules.
 *
 * Use `getTokenIcon(symbol)` instead of indexing directly — it handles
 * Avalanche `.e` bridged aliases, case variance, and falls back to a
 * deterministic placeholder.
 */

const COINGECKO = (id: string, slug: string) =>
  `https://assets.coingecko.com/coins/images/${id}/small/${slug}`;

const COINGECKO_IMG = (id: string, slug: string) =>
  `https://coin-images.coingecko.com/coins/images/${id}/small/${slug}`;

export const TOKEN_ICONS: Record<string, string> = {
  // Majors
  ETH:    COINGECKO('279', 'ethereum.png'),
  WETH:   COINGECKO('2518', 'weth.png'),
  WBTC:   COINGECKO('7598', 'wrapped_bitcoin_wbtc.png'),
  'BTC.b': COINGECKO('26115', 'btcb.png'),
  cbBTC:  COINGECKO('40489', 'cbBTC.png'),

  // Stables
  USDC:   COINGECKO('6319', 'usdc.png'),
  USDT:   COINGECKO('325', 'Tether.png'),
  DAI:    COINGECKO('9956', 'Badge_Dai.png'),
  TUSD:   COINGECKO('3449', 'tusd.png'),
  MIM:    COINGECKO('16786', 'mimlogopng.png'),
  USDe:   COINGECKO('33613', 'USDE.png'),
  AUSD:   COINGECKO('38923', 'ausd_200x200.png'),
  EURC:   COINGECKO('26045', 'eurc.png'),
  USDbC:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA/logo.png',

  // Avalanche
  AVAX:   COINGECKO('12559', 'Avalanche_Circle_RedWhite_Trans.png'),
  WAVAX:  COINGECKO('15075', 'wrapped-avax.png'),
  sAVAX:  COINGECKO('23517', 'sAVAX_logo.png'),
  JOE:    COINGECKO('17569', 'traderjoe.png'),
  QI:     COINGECKO('18177', 'Qi.png'),

  // DeFi blue chips
  AAVE:   COINGECKO('12645', 'aave-token-round.png'),
  COMP:   COINGECKO('10775', 'COMP.png'),
  UNI:    COINGECKO('12504', 'uni.jpg'),
  LINK:   COINGECKO('877', 'chainlink-new-logo.png'),
  LDO:    COINGECKO('13573', 'Lido_DAO.png'),
  GMX:    COINGECKO('18323', 'arbit.png'),
  QUICK:  COINGECKO('13970', '1_pOU6pBMEmiL-ZJVb0CYRjQ.png'),
  CAKE:   COINGECKO('12632', 'IMG_0440.PNG'),
  AERO:   COINGECKO('31745', 'token.png'),
  CRV:    COINGECKO('12124', 'Curve.png'),

  // L1 / L2
  MATIC:  COINGECKO('4713', 'matic-token-icon.png'),
  ARB:    COINGECKO('16547', 'photo_2023-03-29_21.47.00.jpeg'),
  OP:     COINGECKO('25244', 'Optimism.png'),
  BNB:    COINGECKO('825', 'bnb-icon2_2x.png'),
  TON:    COINGECKO('17980', 'ton_symbol.png'),
  WLD:    COINGECKO('31069', 'worldcoin.jpeg'),

  // Misc
  SAND:   COINGECKO('12129', 'sandbox_logo.jpg'),
  ADA:    COINGECKO('975', 'cardano.png'),
  DOGE:   COINGECKO('5', 'dogecoin.png'),
  XRP:    COINGECKO('44', 'xrp-symbol-white-128.png'),
  DOT:    COINGECKO('12171', 'polkadot.png'),
  PEPE:   COINGECKO('29850', 'pepe-token.jpeg'),

  // Base-specific / Metronome
  wstETH: COINGECKO('18834', 'wstETH.png'),
  VIRTUAL: COINGECKO_IMG('34057', 'LOGOMARK.png'),
  msETH:  COINGECKO_IMG('67512', 'metronome_mseth.png'),
};

/**
 * Symbol → canonical-symbol aliases. Keys are lowercased for
 * case-insensitive lookup; values must exist in `TOKEN_ICONS`.
 */
const TOKEN_ALIASES: Record<string, string> = {
  // Avalanche bridged
  'wbtc.e': 'WBTC',
  'weth.e': 'WETH',
  'usdt.e': 'USDT',
  'usdc.e': 'USDC',
  'dai.e':  'DAI',
  'link.e': 'LINK',
  usdt:     'USDT',
  iavax:    'AVAX',
};

const PLACEHOLDER_ICON =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#2a2a2a" stroke="#555" stroke-width="1"/><text x="12" y="16" font-size="10" font-family="system-ui" fill="#aaa" text-anchor="middle">?</text></svg>',
  );

export function getTokenIcon(symbol: string | null | undefined): string {
  if (!symbol) return PLACEHOLDER_ICON;
  if (TOKEN_ICONS[symbol]) return TOKEN_ICONS[symbol];

  const lower = symbol.toLowerCase();
  const aliased = TOKEN_ALIASES[lower];
  if (aliased && TOKEN_ICONS[aliased]) return TOKEN_ICONS[aliased];

  const upper = symbol.toUpperCase();
  if (TOKEN_ICONS[upper]) return TOKEN_ICONS[upper];

  return PLACEHOLDER_ICON;
}
