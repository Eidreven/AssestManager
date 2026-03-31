import sgMail from '@sendgrid/mail'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'shamikararavindu@gmail.com'
const FROM_EMAIL = process.env.GMAIL_USER ?? 'katherinent2025@gmail.com'
const FROM_NAME = 'MPS Asset Manager'
const SCHOOL = 'Macfarlane Primary School'

function getClient() {
  const key = process.env.SENDGRID_API_KEY
  if (!key) return null
  sgMail.setApiKey(key)
  return sgMail
}

function baseTemplate(title: string, body: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        <tr><td style="background:#1e3a8a;padding:24px 32px;">
          <p style="margin:0;color:#93c5fd;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">${SCHOOL}</p>
          <h1 style="margin:4px 0 0;color:#fff;font-size:20px;font-weight:700;">${title}</h1>
        </td></tr>
        <tr><td style="padding:28px 32px;">${body}</td></tr>
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

async function sendMail(to: string, subject: string, html: string) {
  const client = getClient()
  if (!client) {
    console.warn('Email not configured — set SENDGRID_API_KEY in environment variables')
    return
  }
  await client.send({
    to,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject,
    html,
  })
}

// ── 0. Password reset ─────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(params: {
  toEmail: string
  toName: string
  resetUrl: string
}) {
  const { toEmail, toName, resetUrl } = params
  const body = `
    <p style="margin:0 0 16px;color:#374151;font-size:15px;">Hi ${toName},</p>
    <p style="margin:0 0 20px;color:#374151;font-size:15px;">
      We received a request to reset your password for MPS Asset Manager.
      Click the button below to choose a new password.
    </p>
    <a href="${resetUrl}" style="display:inline-block;background:#1e3a8a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;margin-bottom:20px;">
      Reset My Password
    </a>
    <p style="margin:20px 0 0;color:#6b7280;font-size:13px;">
      This link expires in <strong>1 hour</strong>. If you did not request this, you can safely ignore this email.
    </p>
  `
  await sendMail(toEmail, 'Reset your MPS Asset Manager password', baseTemplate('Password Reset', body))
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
    <p style="margin:0 0 20px;color:#374151;font-size:15px;">A new request has been submitted and needs your attention.</p>
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
    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/requests" style="display:inline-block;background:#1e3a8a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">
      View Request #${requestId}
    </a>
  `
  await sendMail(
    ADMIN_EMAIL,
    `[${PRIORITY_LABELS[priority] ?? priority}] New ${requestType} request — ${assetTag}`,
    baseTemplate('New Request Submitted', body)
  )
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
    <p style="margin:0 0 20px;color:#374151;font-size:15px;">Your request has been received. The IT team will review it shortly.</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <tr><td style="padding:16px;">
        <table cellpadding="0" cellspacing="0" width="100%">
          ${row('Device', `${assetTag} — ${assetName}`)}
          ${row('Request Type', TYPE_LABELS[requestType] ?? requestType)}
          ${row('Status', '⏳ Pending review')}
        </table>
      </td></tr>
    </table>
    <p style="margin:0;color:#6b7280;font-size:13px;">You will receive another email once your request has been reviewed.</p>
  `
  await sendMail(requesterEmail, `Request received — ${assetTag}`, baseTemplate('Request Received', body))
}

// ── 3. Notify admin of new allocation ─────────────────────────────────────────

export async function sendAllocationNotification(params: {
  assetTag: string
  assetName: string
  assetType: string
  allocatedTo: string
  allocatedToRole: string | null
  locationName?: string | null
  purpose?: string | null
  isTemporary: boolean
  expectedReturn?: string | null
  allocatedByName: string
  notes?: string | null
}) {
  const { assetTag, assetName, assetType, allocatedTo, allocatedToRole, locationName, purpose, isTemporary, expectedReturn, allocatedByName, notes } = params
  const body = `
    <p style="margin:0 0 20px;color:#374151;font-size:15px;">A device has been allocated by <strong>${allocatedByName}</strong>.</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <tr><td style="background:#f9fafb;padding:12px 16px;border-bottom:1px solid #e5e7eb;">
        <span style="font-weight:700;color:#1e3a8a;font-family:monospace;font-size:14px;">${assetTag}</span>
        <span style="color:#6b7280;font-size:14px;margin-left:8px;">— ${assetName} (${assetType})</span>
      </td></tr>
      <tr><td style="padding:16px;">
        <table cellpadding="0" cellspacing="0" width="100%">
          ${row('Allocated To', allocatedTo)}
          ${row('Role', allocatedToRole)}
          ${row('Location', locationName)}
          ${row('Purpose', purpose)}
          ${row('Type', isTemporary ? '⏳ Temporary' : '📌 Permanent')}
          ${expectedReturn ? row('Expected Return', expectedReturn) : ''}
          ${notes ? row('Notes', notes) : ''}
        </table>
      </td></tr>
    </table>
    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/assets" style="display:inline-block;background:#1e3a8a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">View Assets</a>
  `
  await sendMail(ADMIN_EMAIL, `Device allocated — ${assetTag} → ${allocatedTo}`, baseTemplate('Device Allocated', body))
}

// ── 4. Notify admin when device is returned ───────────────────────────────────

export async function sendReturnNotification(params: {
  assetTag: string
  assetName: string
  returnedFrom: string
  returnedByName: string
}) {
  const { assetTag, assetName, returnedFrom, returnedByName } = params
  const body = `
    <p style="margin:0 0 20px;color:#374151;font-size:15px;">A device has been marked as returned by <strong>${returnedByName}</strong>.</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <tr><td style="padding:16px;">
        <table cellpadding="0" cellspacing="0" width="100%">
          ${row('Device', `${assetTag} — ${assetName}`)}
          ${row('Returned From', returnedFrom)}
          ${row('Status', '✅ Now Available')}
        </table>
      </td></tr>
    </table>
    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/assets" style="display:inline-block;background:#1e3a8a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">View Assets</a>
  `
  await sendMail(ADMIN_EMAIL, `Device returned — ${assetTag} now available`, baseTemplate('Device Returned', body))
}

// ── 5. Request status update to requester ─────────────────────────────────────

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
      ${approved ? 'Good news — your request has been approved.' : 'Your request has been reviewed and unfortunately cannot be fulfilled at this time.'}
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
    <p style="margin:0;color:#6b7280;font-size:13px;">If you have any questions, please contact the IT team directly.</p>
  `
  await sendMail(requesterEmail, `Your request has been ${status} — ${assetTag}`, baseTemplate(`Request ${approved ? 'Approved' : 'Rejected'}`, body))
}
