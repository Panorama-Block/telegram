import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const host = request.headers.get('x-forwarded-host') || url.host;
    const protocol = request.headers.get('x-forwarded-proto') || url.protocol.replace(/:$/, '');
    const origin = `${protocol}://${host}`;
    const base = `${origin}/miniapp`;
    const manifest = {
      url: base,
      name: 'Zico MiniApp — TON Wallet',
      iconUrl: `${base}/telegram_img.png`,
    };

    return NextResponse.json(manifest, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'failed to build manifest' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    },
  });
}
