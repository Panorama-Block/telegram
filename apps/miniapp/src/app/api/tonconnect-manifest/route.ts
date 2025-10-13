import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const origin = `${url.protocol}//${url.host}`;
    const base = `${origin}/miniapp`;
    const json = {
      url: base,
      name: 'Zico MiniApp — TON Wallet',
      iconUrl: `${base}/telegram_img.png`,
      termsOfUseUrl: '',
      privacyPolicyUrl: '',
    };
    return NextResponse.json(json);
  } catch {
    return NextResponse.json({ error: 'failed to build manifest' }, { status: 500 });
  }
}
