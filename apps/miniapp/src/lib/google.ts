import { google } from 'googleapis'

// ─── Auth ────────────────────────────────────────────────────────────────────

function getOAuthClient() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground',
  )
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return client
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AllocationPayload {
  amountUSD: number
  tokens: number
  wallet: string
  email: string
  telegram: string
  phone: string
}

// ─── Sheets ──────────────────────────────────────────────────────────────────

const SHEET_NAME = 'Allocations'
const SHEET_HEADERS = ['Timestamp', 'Wallet', 'Email', 'Telegram', 'Phone', 'Amount (USD)', 'Tokens (PANBLK)', 'Status']

export async function appendAllocation(data: AllocationPayload): Promise<void> {
  const auth  = getOAuthClient()
  const sheets = google.sheets({ version: 'v4', auth })
  const sheetId = process.env.GOOGLE_SHEET_ID!

  // Ensure header row exists on first use
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${SHEET_NAME}!A1:H1`,
  }).catch(() => null)

  const firstRow = existing?.data?.values?.[0]
  // Update headers if missing or column count changed
  if (!firstRow || firstRow.length !== SHEET_HEADERS.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!A1:H1`,
      valueInputOption: 'RAW',
      requestBody: { values: [SHEET_HEADERS] },
    })
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${SHEET_NAME}!A:H`,
    // RAW prevents "+" in phone numbers being parsed as formulas
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[
        new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false }).replace(',', ''),
        data.wallet   || '—',
        data.email    || '—',
        data.telegram || '—',
        data.phone    || '—',
        data.amountUSD,
        data.tokens,
        'Pending Review',
      ]],
    },
  })
}

// ─── Gmail ───────────────────────────────────────────────────────────────────

function encodeMime(to: string, subject: string, html: string): string {
  const from = process.env.GMAIL_FROM!
  const raw = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    html,
  ].join('\r\n')

  return Buffer.from(raw).toString('base64url')
}

async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const auth  = getOAuthClient()
  const gmail = google.gmail({ version: 'v1', auth })

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodeMime(to, subject, html) },
  })
}

// ─── Email templates ─────────────────────────────────────────────────────────

export async function sendConfirmationEmail(data: AllocationPayload): Promise<void> {
  if (!data.email) return

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#050505;font-family:'Courier New',monospace;color:#f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 0;">
        <tr><td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid rgba(255,255,255,0.1);border-radius:16px;overflow:hidden;">

            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg,rgba(34,211,238,0.15),transparent);padding:32px 40px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
                <p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(34,211,238,0.7);">Panorama Block</p>
                <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">Allocation Request Received</h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px 40px;">
                <p style="margin:0 0 24px;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.7;">
                  Thank you for your interest in the $PANBLK Seed Round. Our team will review your request and reach out with allocation confirmation and payment instructions.
                </p>

                <!-- Summary box -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;margin-bottom:24px;">
                  <tr><td style="padding:20px 24px;">
                    <p style="margin:0 0 12px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.35);">Request Summary</p>
                    ${row('Intended amount', `$${data.amountUSD.toLocaleString()} USD`)}
                    ${row('Tokens requested', `${data.tokens.toLocaleString()} PANBLK`)}
                    ${row('Wallet submitted', data.wallet ? `${data.wallet.slice(0, 6)}…${data.wallet.slice(-4)}` : 'To be provided')}
                    ${row('Seed price', '$0.025 per PANBLK')}
                    ${row('Est. value at listing', `$${(data.tokens * 0.08).toLocaleString()} USD`)}
                  </td></tr>
                </table>

                <!-- Next steps -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(34,211,238,0.05);border:1px solid rgba(34,211,238,0.15);border-radius:12px;margin-bottom:24px;">
                  <tr><td style="padding:16px 20px;">
                    <p style="margin:0 0 8px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(34,211,238,0.6);">What happens next</p>
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.5);line-height:1.7;">
                      1. Our team reviews your request (within 24h)<br>
                      2. You receive allocation confirmation with payment instructions<br>
                      3. After transfer, we verify and confirm your allocation<br>
                      4. Tokens distributed at TGE per vesting schedule
                    </p>
                  </td></tr>
                </table>

                <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.3);line-height:1.6;">
                  Questions? Reply to this email or reach us on Telegram at <a href="https://t.me/panoramablock" style="color:rgba(34,211,238,0.7);text-decoration:none;">@panoramablock</a>.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.05);">
                <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.2);text-align:center;">
                  Panorama Block · Seed Round · $PANBLK · This email was sent because you submitted an allocation request.
                </p>
              </td>
            </tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `

  await sendMail(data.email, '$PANBLK Seed Round - Allocation Request Received', html)
}

export async function sendAdminNotification(data: AllocationPayload): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) return

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#050505;font-family:'Courier New',monospace;color:#f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;background:#050505;">
        <tr><td align="center">
          <table width="520" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid rgba(255,255,255,0.1);border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:24px 32px;border-bottom:1px solid rgba(255,255,255,0.06);">
                <p style="margin:0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(34,211,238,0.6);">New Allocation Request</p>
                <h2 style="margin:6px 0 0;font-size:18px;font-weight:700;color:#ffffff;">$${data.amountUSD.toLocaleString()} USD · ${data.tokens.toLocaleString()} PANBLK</h2>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
                  <tr><td style="padding:16px 20px;">
                    ${row('Timestamp', new Date().toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC')}
                    ${row('Amount', `$${data.amountUSD.toLocaleString()} USD`)}
                    ${row('Tokens', `${data.tokens.toLocaleString()} PANBLK`)}
                    ${row('Wallet', data.wallet || '— not provided')}
                    ${row('Email', data.email || '— not provided')}
                    ${row('Telegram', data.telegram || '— not provided')}
                    ${row('Phone', data.phone || '— not provided')}
                  </td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `

  await sendMail(adminEmail, `[PANBLK] New allocation request - $${data.amountUSD.toLocaleString()}`, html)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function row(label: string, value: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr>
        <td style="font-size:11px;color:rgba(255,255,255,0.35);width:50%;">${label}</td>
        <td style="font-size:11px;color:rgba(255,255,255,0.8);text-align:right;">${value}</td>
      </tr>
    </table>
  `
}
