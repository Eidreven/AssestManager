import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const ADMIN_EMAIL = 'katherinent2025@gmail.com'
const FROM = 'MPS Asset Manager <onboarding@resend.dev>'
const SCHOOL = 'Macfarlane Primary School'

function baseTemplate(title: string, body: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr><td style="background:#1e3a8a;padding:24px 32px;">
          <p style="margin:0;color:#93c5fd;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">${SCHOOL}</p>
          <h1 style="margin:4px 0 0;color:#fff;font-size:20px;font-weight:700;">${title}</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:28px 32px;">
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">MPS Asset Manager · ${SCHOOL}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function row(label: string, value: string | null | undefined) {
  if (!value) return ''
  return `<tr>
    <td style="padding:6px 0;color:#6b7280;font-size:13px;width:140px;vertical-align:top;">${label}</td>
    <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:500;">${value}</td>
  </tr>`
}

const TYPE_LABELS: Record<string, string> = {
  issue: '🔧 Issue / Problem',
  borrow: '✋ Borrow Request',
  relocate: '🚚 Relocation Request',
}

const PRIORITY_LABELS: Record<string, string> = {
  low: '🟢 Low',
  medium: '🟡 Medium',
  high: '🟠 High',
  urgent: '🔴 Urgent',
}

// ── 1. Notify admin of new request ────────────────────────────────────────────

export async function sendNewRequestNotification(params: {
  requestId: number
  assetTag: string
  assetName: string
  requestType: string
  priority: string
  requesterName: string
  requesterEmail?: string | null
  requesterPhone?: string | null
  reason?: string | null
}) {
  const { requestId, assetTag, assetName, requestType, priority, requesterName, requesterEmail, requesterPhone, reason } = params

  const body = `
    <p style="margin:0 0 20px;color:#374151;font-size:15px;">
      A new request has been submitted and needs your attention.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <tr><td style="background:#f9fafb;padding:12px 16px;border-bottom:1px solid #e5e7eb;">
        <span style="font-weight:700;color:#1e3a8a;font-family:monospace;font-size:14px;">${assetTag}</span>
        <span style="color:#6b7280;font-size:14px;margin-left:8px;">— ${assetName}</span>
      </td></tr>
      <tr><td style="padding:16px;">
        <table cellpadding="0" cellspacing="0" width="100%">
          ${row('Request Type', TYPE_LABELS[requestType] ?? requestType)}
          ${row('Priority', PRIORITY_LABELS[priority] ?? priority)}
          ${row('Submitted By', requesterName)}
          ${row('Email', requesterEmail)}
          ${row('Phone', requesterPhone)}
          ${reason ? row('Description', reason) : ''}
        </table>
      </td></tr>
    </table>
    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/requests"
       style="display:inline-block;background:#1e3a8a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">
      View Request #${requestId}
    </a>
  `

  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `[${PRIORITY_LABELS[priority] ?? priority}] New ${requestType} request — ${assetTag}`,
    html: baseTemplate('New Request Submitted', body),
  })
}

// ── 2. Confirm receipt to requester ───────────────────────────────────────────

export async function sendRequestConfirmation(params: {
  requesterName: string
  requesterEmail: string
  assetTag: string
  assetName: string
  requestType: string
}) {
  const { requesterName, requesterEmail, assetTag, assetName, requestType } = params

  const body = `
    <p style="margin:0 0 16px;color:#374151;font-size:15px;">Hi ${requesterName},</p>
    <p style="margin:0 0 20px;color:#374151;font-size:15px;">
      Your request has been received. The IT team will review it shortly.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <tr><td style="padding:16px;">
        <table cellpadding="0" cellspacing="0" width="100%">
          ${row('Device', `${assetTag} — ${assetName}`)}
          ${row('Request Type', TYPE_LABELS[requestType] ?? requestType)}
          ${row('Status', '⏳ Pending review')}
        </table>
      </td></tr>
    </table>
    <p style="margin:0;color:#6b7280;font-size:13px;">
      You will receive another email once your request has been reviewed.
    </p>
  `

  await resend.emails.send({
    from: FROM,
    to: requesterEmail,
    subject: `Request received — ${assetTag}`,
    html: baseTemplate('Request Received', body),
  })
}

// ── 3. Notify requester of status update ──────────────────────────────────────

export async function sendRequestStatusUpdate(params: {
  requesterName: string
  requesterEmail: string
  assetTag: string
  assetName: string
  requestType: string
  status: string
  handlerNotes?: string | null
}) {
  const { requesterName, requesterEmail, assetTag, assetName, requestType, status, handlerNotes } = params

  const approved = status === 'approved' || status === 'completed'
  const statusLabel = status === 'approved' ? '✅ Approved' : status === 'completed' ? '✅ Completed' : '❌ Rejected'

  const body = `
    <p style="margin:0 0 16px;color:#374151;font-size:15px;">Hi ${requesterName},</p>
    <p style="margin:0 0 20px;color:#374151;font-size:15px;">
      ${approved
        ? 'Good news — your request has been approved.'
        : 'Your request has been reviewed and unfortunately cannot be fulfilled at this time.'}
    </p>
    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <tr><td style="padding:16px;">
        <table cellpadding="0" cellspacing="0" width="100%">
          ${row('Device', `${assetTag} — ${assetName}`)}
          ${row('Request Type', TYPE_LABELS[requestType] ?? requestType)}
          ${row('Status', statusLabel)}
          ${handlerNotes ? row('Notes from IT', handlerNotes) : ''}
        </table>
      </td></tr>
    </table>
    <p style="margin:0;color:#6b7280;font-size:13px;">
      If you have any questions, please contact the IT team directly.
    </p>
  `

  await resend.emails.send({
    from: FROM,
    to: requesterEmail,
    subject: `Your request has been ${status} — ${assetTag}`,
    html: baseTemplate(`Request ${approved ? 'Approved' : 'Rejected'}`, body),
  })
}
