import type { VercelRequest, VercelResponse } from '@vercel/node';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const ADMIN_EMAIL = 'bradley@neuralcommander.ai'; // Change to your email
const FROM_EMAIL = 'noreply@neuralcommander.ai'; // Must be verified in SendGrid

interface WaitlistData {
  email: string;
  name?: string;
  type: 'waitlist' | 'foundation100';
}

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
    const { email, name, type } = req.body as WaitlistData;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    if (!SENDGRID_API_KEY) {
      console.error('SendGrid API key not configured');
      return res.status(500).json({ error: 'Email service not configured' });
    }

    // 1. Send confirmation email to user
    const userEmailResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: FROM_EMAIL, name: 'Neural Commander' },
        subject: type === 'foundation100'
          ? '🎉 Welcome to Foundation 100!'
          : '🚀 You\'re on the Neural Commander Waitlist!',
        content: [{
          type: 'text/html',
          value: type === 'foundation100'
            ? getFoundation100Email(name || 'there')
            : getWaitlistEmail(name || 'there'),
        }],
      }),
    });

    if (!userEmailResponse.ok) {
      const errorText = await userEmailResponse.text();
      console.error('SendGrid error (user):', errorText);
      throw new Error('Failed to send confirmation email');
    }

    // 2. Send notification to admin
    const adminEmailResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: ADMIN_EMAIL }] }],
        from: { email: FROM_EMAIL, name: 'NC Waitlist' },
        subject: type === 'foundation100'
          ? `💰 Foundation 100 Signup: ${email}`
          : `📋 New Waitlist Signup: ${email}`,
        content: [{
          type: 'text/html',
          value: `
            <h2>${type === 'foundation100' ? 'Foundation 100' : 'Waitlist'} Signup</h2>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Name:</strong> ${name || 'Not provided'}</p>
            <p><strong>Type:</strong> ${type}</p>
            <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          `,
        }],
      }),
    });

    if (!adminEmailResponse.ok) {
      console.error('SendGrid error (admin):', await adminEmailResponse.text());
      // Don't fail if admin notification fails
    }

    // 3. Add to SendGrid contact list (optional but recommended)
    await addToContactList(email, name, type);

    return res.status(200).json({
      success: true,
      message: 'Successfully joined the waitlist!'
    });

  } catch (error) {
    console.error('Waitlist error:', error);
    return res.status(500).json({ error: 'Failed to process signup' });
  }
}

async function addToContactList(email: string, name: string | undefined, type: string) {
  if (!SENDGRID_API_KEY) return;

  try {
    await fetch('https://api.sendgrid.com/v3/marketing/contacts', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contacts: [{
          email,
          first_name: name || '',
          custom_fields: {
            signup_type: type,
            signup_date: new Date().toISOString(),
          },
        }],
      }),
    });
  } catch (error) {
    console.error('Failed to add to contact list:', error);
  }
}

function getWaitlistEmail(name: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #4a9eff, #3d8ce6); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; }
    .button { display: inline-block; background: #4a9eff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">🚀 You're on the List!</h1>
    </div>
    <div class="content">
      <p>Hey ${name},</p>
      <p>Welcome to the Neural Commander waitlist! You're now in line for early access to the v0.99 beta launching Q4 2025.</p>

      <h3>What's Next?</h3>
      <ul>
        <li>We'll email you when beta invites start going out</li>
        <li>Invites go out in order of signup</li>
        <li>Your Community tier will be free forever</li>
      </ul>

      <h3>Want Lifetime Pro?</h3>
      <p>Foundation 100 members get lifetime Pro access for a one-time $97 payment. Only 100 spots available.</p>
      <a href="https://neuralcommander.ai/foundation-100" class="button">Learn About Foundation 100</a>

      <p>Thanks for believing in what we're building!</p>
      <p>— Bradley & the Neural Commander Team</p>
    </div>
    <div class="footer">
      <p>Neural Commander • Liberation Technology for Developers</p>
      <p>© 2025 Neural Commander Pty Ltd</p>
    </div>
  </div>
</body>
</html>
  `;
}

function getFoundation100Email(name: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #4a9eff, #10b981); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; }
    .badge { display: inline-block; background: #fbbf24; color: #78350f; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 12px; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">🎉 Welcome, Founding Member!</h1>
      <p class="badge">FOUNDATION 100</p>
    </div>
    <div class="content">
      <p>Hey ${name},</p>
      <p>You're officially a Neural Commander Founding Member! Welcome to the Foundation 100.</p>

      <h3>Your Lifetime Benefits:</h3>
      <ul>
        <li>✅ Lifetime Pro license (never pay again)</li>
        <li>✅ All future Pro features included</li>
        <li>✅ Founding member badge</li>
        <li>✅ Priority support forever</li>
        <li>✅ Vote on product roadmap</li>
        <li>✅ Early access to v0.99 beta</li>
      </ul>

      <h3>What's Next?</h3>
      <p>We'll reach out before beta launch (Q4 2025) with payment details and your exclusive access link. You'll be among the very first to use Neural Commander.</p>

      <p>Thank you for believing in liberation technology. You're helping us build the future of AI-assisted development.</p>

      <p>— Bradley Hughes, Founder</p>
    </div>
    <div class="footer">
      <p>Neural Commander • Liberation Technology for Developers</p>
      <p>© 2025 Neural Commander Pty Ltd • IP held by Artilect Ventures Pty Ltd</p>
    </div>
  </div>
</body>
</html>
  `;
}
