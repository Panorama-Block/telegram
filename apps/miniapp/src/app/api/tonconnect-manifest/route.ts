import { NextResponse } from 'next/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const host = request.headers.get('x-forwarded-host') || url.host;
    const protocol = request.headers.get('x-forwarded-proto') || url.protocol.replace(/:$/, '');
    const origin = `${protocol}://${host}`;
    const base = `${origin}/miniapp`;
    const json = {
      url: base,
      name: 'Zico MiniApp — TON Wallet',
      iconUrl: `${base}/telegram_img.png`
    };
    return NextResponse.json(json, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json(
      { error: 'failed to build manifest' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

export function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS, status: 204 });
}
