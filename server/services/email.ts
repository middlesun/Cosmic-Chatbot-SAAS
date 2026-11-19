export interface SendEmailResult {
  sent: boolean;
  id?: string;
  reason?: string;
}

const getFromEmail = (): string =>
  process.env.RESEND_FROM_EMAIL || 'Cosmic Council PRO <concierge@cosmiccouncil.pro>';

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

async function sendResendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, reason: 'RESEND_API_KEY not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getFromEmail(),
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        sent: false,
        reason: (data as { message?: string }).message || `Resend error (${response.status})`,
      };
    }

    return {
      sent: true,
      id: (data as { id?: string }).id,
    };
  } catch (err) {
    return {
      sent: false,
      reason: err instanceof Error ? err.message : 'Email transport failed',
    };
  }
}

function wrapObservatoryLayout(title: string, bodyHtml: string): string {
  return `
  <div style="background-color:#FAF7F2;padding:36px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#3D3830;">
    <div style="max-width:580px;margin:0 auto;background-color:#FDFBF7;border:1px solid rgba(61,56,48,0.12);border-radius:20px;overflow:hidden;">
      <div style="background-color:#1F2229;padding:24px 32px;color:#F4EFE6;">
        <p style="margin:0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(244,239,230,0.65);">Cosmic Council PRO</p>
        <h1 style="margin:8px 0 0;font-family:Georgia,serif;font-size:24px;font-weight:500;color:#F4EFE6;">${title}</h1>
      </div>
      <div style="padding:28px 32px;font-size:14px;line-height:1.7;color:#5C5449;">
        ${bodyHtml}
      </div>
      <div style="padding:18px 32px;background-color:#F1ECE3;font-size:12px;color:#8B8275;border-top:1px solid rgba(61,56,48,0.08);">
        Cosmic Council Observatory · Authentic Multi-System Vedic Guidance
      </div>
    </div>
  </div>`;
}

export async function sendWelcomeEmail(params: {
  to: string;
  name?: string | null;
}): Promise<SendEmailResult> {
  const displayName = params.name?.trim() || 'Seeker';
  const html = wrapObservatoryLayout(
    'Welcome to Your Observatory',
    `<p>Namaste ${displayName},</p>
     <p>Your private Cosmic Council PRO workspace is ready. Save your birth profiles, explore multi-system Vedic consultations (Parashari, KP, Jaimini, and Nadi), and track planetary timing phases in real time.</p>
     <p style="margin-top:20px;"><strong>Warm regards,</strong><br/>Cosmic Council Concierge</p>`
  );
  return sendResendEmail({
    to: params.to,
    subject: 'Welcome to Cosmic Council PRO',
    html,
  });
}

export async function sendPaymentReceiptEmail(params: {
  to: string;
  name?: string | null;
  amountPaid: number;
  currency: string;
  creditsGranted: number;
  packageLabel: string;
  orderId: string;
}): Promise<SendEmailResult> {
  const displayName = params.name?.trim() || 'Seeker';
  const html = wrapObservatoryLayout(
    'Credit & Membership Confirmation',
    `<p>Namaste ${displayName},</p>
     <p>Thank you for your purchase with Cosmic Council PRO. Your credits have been added to your account immediately.</p>
     <div style="background:#F1ECE3;border-radius:14px;padding:16px 20px;margin:18px 0;font-size:13px;color:#3D3830;">
       <div><strong>Item:</strong> ${params.packageLabel}</div>
       <div><strong>Credits Credited:</strong> ${params.creditsGranted.toLocaleString()} Credits</div>
       <div><strong>Amount Paid:</strong> ${params.currency} ${params.amountPaid.toLocaleString()}</div>
       <div><strong>Order Reference:</strong> ${params.orderId}</div>
     </div>
     <p>You can inspect your full balance and transaction ledger anytime inside the Credits tab.</p>`
  );
  return sendResendEmail({
    to: params.to,
    subject: `Cosmic Council Receipt — ${params.creditsGranted.toLocaleString()} Credits Added`,
    html,
  });
}

export async function sendReferralBonusEmail(params: {
  to: string;
  name?: string | null;
  creditsAwarded: number;
}): Promise<SendEmailResult> {
  const displayName = params.name?.trim() || 'Seeker';
  const html = wrapObservatoryLayout(
    'Referral Credits Unlocked',
    `<p>Namaste ${displayName},</p>
     <p>A friend you invited just completed their first paid purchase or chart activation. As promised, <strong>${params.creditsAwarded.toLocaleString()} Credits</strong> have been credited to both of your accounts.</p>
     <p>Thank you for sharing Cosmic Council PRO thoughtfully.</p>`
  );
  return sendResendEmail({
    to: params.to,
    subject: `You earned ${params.creditsAwarded.toLocaleString()} Referral Credits`,
    html,
  });
}

export async function sendReportReadyEmail(params: {
  to: string;
  name?: string | null;
  reportTitle: string;
  profileName: string;
  appUrl: string;
}): Promise<SendEmailResult> {
  const displayName = params.name?.trim() || 'Seeker';
  const html = wrapObservatoryLayout(
    'Your Deep Research Report Is Ready',
    `<p>Namaste ${displayName},</p>
     <p>Your multi-pass Vedic Deep Research Report <strong>${params.reportTitle}</strong> for <strong>${params.profileName}</strong> is complete.</p>
     <p>Your typeset PDF and an interactive follow-up consultation thread pre-loaded with this report are waiting in your studio.</p>
     <p style="margin-top:20px;"><a href="${params.appUrl}/app/reports" style="display:inline-block;background:#4A453D;color:#FAF7F2;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:500;">Open Your Report</a></p>`
  );
  return sendResendEmail({
    to: params.to,
    subject: `Report Complete: ${params.reportTitle}`,
    html,
  });
}

export async function sendClientInviteEmail(params: {
  to: string;
  name?: string | null;
  loginUrl: string;
  tempPassword?: string;
}): Promise<SendEmailResult> {
  const displayName = params.name?.trim() || 'Valued Client';
  const html = wrapObservatoryLayout(
    'Your Private Observatory Account Is Ready',
    `<p>Namaste ${displayName},</p>
     <p>Your personal Cosmic Council PRO observatory account has been prepared with your consultation history and saved birth profile.</p>
     ${
       params.tempPassword
         ? `<div style="background:#F1ECE3;border-radius:14px;padding:16px 20px;margin:18px 0;font-size:13px;color:#3D3830;">
              <div><strong>Email:</strong> ${params.to}</div>
              <div><strong>Temporary Password:</strong> <code>${params.tempPassword}</code></div>
              <div style="margin-top:6px;font-size:12px;color:#5C5449;">You will be prompted to choose your own permanent password right after signing in.</div>
            </div>`
         : ''
     }
     <p style="margin-top:20px;"><a href="${params.loginUrl}" style="display:inline-block;background:#4A453D;color:#FAF7F2;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:500;">Enter Cosmic Council PRO</a></p>`
  );
  return sendResendEmail({
    to: params.to,
    subject: 'Your Cosmic Council PRO Observatory Invitation',
    html,
  });
}

export async function sendSupportInquiryEmail(params: {
  fromName: string;
  fromEmail: string;
  category: string;
  subject: string;
  message: string;
  userId: string;
}): Promise<SendEmailResult> {
  const supportTarget =
    (process.env.SUPPORT_EMAIL || process.env.RESEND_SUPPORT_EMAIL || 'support@cosmiccouncil.pro').trim();
  const safeMsg = params.message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');

  const html = wrapObservatoryLayout(
    `Support Request: ${params.category}`,
    `<div style="background:#F1ECE3;border-radius:14px;padding:14px 18px;margin-bottom:16px;font-size:13px;color:#3D3830;">
       <div><strong>From:</strong> ${params.fromName} (${params.fromEmail})</div>
       <div><strong>User ID:</strong> ${params.userId}</div>
       <div><strong>Topic:</strong> ${params.category}</div>
       <div><strong>Subject:</strong> ${params.subject}</div>
     </div>
     <div style="font-size:14px;line-height:1.65;color:#3D3830;">${safeMsg}</div>`
  );

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, reason: 'RESEND_API_KEY not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getFromEmail(),
        to: [supportTarget],
        reply_to: params.fromEmail,
        subject: `[Support · ${params.category}] ${params.subject}`,
        html,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        sent: false,
        reason: (data as { message?: string }).message || `Resend error (${response.status})`,
      };
    }
    return { sent: true, id: (data as { id?: string }).id };
  } catch (err) {
    return {
      sent: false,
      reason: err instanceof Error ? err.message : 'Email transport failed',
    };
  }
}

