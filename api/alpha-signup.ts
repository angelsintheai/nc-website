import type { VercelRequest, VercelResponse } from '@vercel/node';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
const ADMIN_EMAIL = 'bradley@neuralcommander.ai';
const FROM_EMAIL = 'hello@neuralcommander.ai';

interface AlphaSignupData {
  name: string;
  email: string;
  github: string;
  discovery: string;
  motivation: string;
  turnstileToken?: string;
}

const DISCOVERY_LABELS: Record<string, string> = {
  twitter: 'Twitter/X',
  hackernews: 'Hacker News',
  reddit: 'Reddit',
  referral: 'Friend referral',
  google: 'Google search',
  'ai-communities': 'AI coding communities',
  other: 'Other',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, email, github, discovery, motivation, turnstileToken } = req.body as AlphaSignupData;

    // Validation
    if (!name || !email || !github || !discovery || !motivation) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    if (motivation.length < 20) {
      return res.status(400).json({ error: 'Please provide a more detailed motivation' });
    }

    // Validate GitHub username format
    const githubPattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
    if (!githubPattern.test(github)) {
      return res.status(400).json({ error: 'Invalid GitHub username format' });
    }

    // Verify Turnstile token
    if (TURNSTILE_SECRET_KEY && turnstileToken) {
      const turnstileValid = await verifyTurnstile(turnstileToken);
      if (!turnstileValid) {
        return res.status(400).json({ error: 'Bot verification failed. Please try again.' });
      }
    }

    // Log the signup
    console.log('🎉 NEW ALPHA SIGNUP:', {
      name,
      email,
      github,
      discovery: DISCOVERY_LABELS[discovery] || discovery,
      motivation: motivation.substring(0, 100) + '...',
      timestamp: new Date().toISOString()
    });

    // Send emails if SendGrid is configured
    if (SENDGRID_API_KEY) {
      try {
        // 1. Send admin notification (priority!)
        await sendAdminNotification({ name, email, github, discovery, motivation });

        // 2. Send user confirmation
        await sendUserConfirmation({ name, email, github });

        // 3. Add to SendGrid contacts
        await addToContactList({ name, email, github, discovery });
      } catch (emailError) {
        console.error('Email sending error:', emailError);
        // Continue - don't fail the request
      }
    } else {
      console.log('SendGrid not configured - signup logged but no emails sent');
    }

    return res.status(200).json({
      success: true,
      message: 'Alpha access request submitted!'
    });

  } catch (error) {
    console.error('Alpha signup error:', error);
    return res.status(500).json({ error: 'Failed to process signup' });
  }
}

async function verifyTurnstile(token: string): Promise<boolean> {
  if (!TURNSTILE_SECRET_KEY) return true;

  try {
    const formData = new URLSearchParams();
    formData.append('secret', TURNSTILE_SECRET_KEY);
    formData.append('response', token);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return false;
  }
}

async function sendAdminNotification(data: AlphaSignupData): Promise<void> {
  const discoveryLabel = DISCOVERY_LABELS[data.discovery] || data.discovery;

  await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: ADMIN_EMAIL }] }],
      from: { email: FROM_EMAIL, name: 'NC Alpha Signups' },
      subject: `🧪 Alpha Request: ${data.github} (${data.name})`,
      content: [{
        type: 'text/html',
        value: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; border-radius: 12px 12px 0 0; }
    .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 12px 12px; }
    .field { margin-bottom: 16px; }
    .label { font-weight: bold; color: #555; font-size: 12px; text-transform: uppercase; }
    .value { color: #111; font-size: 14px; margin-top: 4px; }
    .motivation { background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #10b981; }
    .action { background: #4a9eff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <h2 style="margin: 0;">🧪 New Alpha Access Request</h2>
    <p style="margin: 8px 0 0 0; opacity: 0.9;">Received ${new Date().toLocaleString()}</p>
  </div>
  <div class="content">
    <div class="field">
      <div class="label">Name</div>
      <div class="value">${data.name}</div>
    </div>
    <div class="field">
      <div class="label">Email</div>
      <div class="value"><a href="mailto:${data.email}">${data.email}</a></div>
    </div>
    <div class="field">
      <div class="label">GitHub Username</div>
      <div class="value"><a href="https://github.com/${data.github}">@${data.github}</a></div>
    </div>
    <div class="field">
      <div class="label">Discovery Source</div>
      <div class="value">${discoveryLabel}</div>
    </div>
    <div class="field">
      <div class="label">Why They Want to Test</div>
      <div class="motivation">${data.motivation}</div>
    </div>

    <a href="https://github.com/angelsintheai/neural-commander/settings/access" class="action">
      Add Collaborator on GitHub →
    </a>
  </div>
</body>
</html>
        `,
      }],
    }),
  });
}

async function sendUserConfirmation(data: { name: string; email: string; github: string }): Promise<void> {
  await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: data.email }] }],
      from: { email: FROM_EMAIL, name: 'Neural Commander' },
      subject: '🧪 Alpha Access Request Received - Neural Commander',
      content: [{
        type: 'text/html',
        value: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; }
    .step { display: flex; gap: 12px; margin-bottom: 16px; }
    .step-num { width: 28px; height: 28px; background: #10b981; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">🧪 Request Received!</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">Neural Commander Alpha Access</p>
    </div>
    <div class="content">
      <p>Hey ${data.name},</p>
      <p>Thanks for requesting alpha access to Neural Commander! We've received your request and will review it shortly.</p>

      <h3>What happens next?</h3>

      <div class="step">
        <div class="step-num">1</div>
        <div>
          <strong>We review your request</strong><br />
          <span style="color: #666;">Bradley personally reviews each alpha request within 24 hours.</span>
        </div>
      </div>

      <div class="step">
        <div class="step-num">2</div>
        <div>
          <strong>Check your GitHub notifications</strong><br />
          <span style="color: #666;">You'll receive a collaborator invite to <a href="https://github.com/angelsintheai/neural-commander">angelsintheai/neural-commander</a> at @${data.github}.</span>
        </div>
      </div>

      <div class="step">
        <div class="step-num">3</div>
        <div>
          <strong>Download and start testing</strong><br />
          <span style="color: #666;">Once you accept the invite, head to the Releases page to download NC for your platform.</span>
        </div>
      </div>

      <p style="margin-top: 24px;">Questions? Reply to this email or join our <a href="https://t.me/neuralcommander">Telegram group</a>.</p>

      <p>— Bradley & the Neural Commander Team</p>
    </div>
    <div class="footer">
      <p>Neural Commander • Liberation Technology for Developers</p>
      <p>© 2026 Neural Commander Pty Ltd</p>
    </div>
  </div>
</body>
</html>
        `,
      }],
    }),
  });
}

async function addToContactList(data: { name: string; email: string; github: string; discovery: string }): Promise<void> {
  try {
    await fetch('https://api.sendgrid.com/v3/marketing/contacts', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contacts: [{
          email: data.email,
          first_name: data.name,
          custom_fields: {
            signup_type: 'alpha',
            github_username: data.github,
            discovery_source: data.discovery,
            signup_date: new Date().toISOString(),
          },
        }],
      }),
    });
  } catch (error) {
    console.error('Failed to add to contact list:', error);
  }
}
