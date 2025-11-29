import type { VercelRequest, VercelResponse } from '@vercel/node';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const ADMIN_EMAIL = 'bradley@neuralcommander.ai';
const FROM_EMAIL = 'noreply@neuralcommander.ai';

interface ReferralData {
  referrerName: string;
  referrerEmail: string;
  counterpartyAddress?: string;
  friendName: string;
  friendEmail: string;
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
    const { referrerName, referrerEmail, counterpartyAddress, friendName, friendEmail } = req.body as ReferralData;

    // Validation
    if (!referrerName || !referrerEmail || !friendName || !friendEmail) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    if (!referrerEmail.includes('@') || !friendEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid email addresses required' });
    }

    if (referrerEmail.toLowerCase() === friendEmail.toLowerCase()) {
      return res.status(400).json({ error: 'You cannot refer yourself' });
    }

    if (!SENDGRID_API_KEY) {
      console.error('SendGrid API key not configured');
      return res.status(500).json({ error: 'Email service not configured' });
    }

    // Generate unique referral code
    const referralCode = generateReferralCode(referrerEmail);

    // 1. Send invite email to friend
    const friendEmailResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: friendEmail }] }],
        from: { email: FROM_EMAIL, name: 'Neural Commander' },
        subject: `${referrerName} invited you to try Neural Commander`,
        content: [{
          type: 'text/html',
          value: getFriendInviteEmail(friendName, referrerName, referralCode),
        }],
      }),
    });

    if (!friendEmailResponse.ok) {
      const errorText = await friendEmailResponse.text();
      console.error('SendGrid error (friend):', errorText);
      throw new Error('Failed to send invite email');
    }

    // 2. Send confirmation to referrer
    const referrerEmailResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: referrerEmail }] }],
        from: { email: FROM_EMAIL, name: 'Neural Commander' },
        subject: `Your referral to ${friendName} has been sent!`,
        content: [{
          type: 'text/html',
          value: getReferrerConfirmationEmail(referrerName, friendName, counterpartyAddress),
        }],
      }),
    });

    if (!referrerEmailResponse.ok) {
      console.error('SendGrid error (referrer):', await referrerEmailResponse.text());
    }

    // 3. Send notification to admin
    const adminEmailResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: ADMIN_EMAIL }] }],
        from: { email: FROM_EMAIL, name: 'NC Referrals' },
        subject: `🔗 New Referral: ${referrerName} → ${friendName}`,
        content: [{
          type: 'text/html',
          value: `
            <h2>New Referral Submitted</h2>
            <h3>Referrer</h3>
            <p><strong>Name:</strong> ${referrerName}</p>
            <p><strong>Email:</strong> ${referrerEmail}</p>
            <p><strong>Counterparty Address:</strong> ${counterpartyAddress || 'Not provided'}</p>
            <h3>Referred Friend</h3>
            <p><strong>Name:</strong> ${friendName}</p>
            <p><strong>Email:</strong> ${friendEmail}</p>
            <h3>Meta</h3>
            <p><strong>Referral Code:</strong> ${referralCode}</p>
            <p><strong>Time:</strong> ${new Date().toISOString()}</p>
            ${counterpartyAddress ? '<p><strong>⚠️ GIVEKUDOS eligible if friend joins Community</strong></p>' : ''}
          `,
        }],
      }),
    });

    if (!adminEmailResponse.ok) {
      console.error('SendGrid error (admin):', await adminEmailResponse.text());
    }

    // 4. Add both contacts to SendGrid
    await addReferralContacts(referrerEmail, referrerName, friendEmail, friendName, referralCode, counterpartyAddress);

    return res.status(200).json({
      success: true,
      message: 'Referral sent successfully!'
    });

  } catch (error) {
    console.error('Referral error:', error);
    return res.status(500).json({ error: 'Failed to process referral' });
  }
}

function generateReferralCode(email: string): string {
  const hash = email.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  return `NC-${Math.abs(hash).toString(36).toUpperCase().slice(0, 6)}`;
}

async function addReferralContacts(
  referrerEmail: string,
  referrerName: string,
  friendEmail: string,
  friendName: string,
  referralCode: string,
  counterpartyAddress?: string
) {
  if (!SENDGRID_API_KEY) return;

  try {
    await fetch('https://api.sendgrid.com/v3/marketing/contacts', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contacts: [
          {
            email: referrerEmail,
            first_name: referrerName,
            custom_fields: {
              referral_code: referralCode,
              counterparty_address: counterpartyAddress || '',
              referrals_sent: '1',
            },
          },
          {
            email: friendEmail,
            first_name: friendName,
            custom_fields: {
              referred_by: referrerEmail,
              referral_code_used: referralCode,
              signup_type: 'referral',
            },
          },
        ],
      }),
    });
  } catch (error) {
    console.error('Failed to add referral contacts:', error);
  }
}

function getFriendInviteEmail(friendName: string, referrerName: string, referralCode: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #4a9eff, #10b981); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; }
    .button { display: inline-block; background: #4a9eff; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
    .referral-box { background: #e0f2fe; border: 2px dashed #4a9eff; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">You've Been Invited!</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${referrerName} thinks you'd love Neural Commander</p>
    </div>
    <div class="content">
      <p>Hey ${friendName},</p>
      <p>Your friend <strong>${referrerName}</strong> is using Neural Commander — the AI-powered tool that keeps your project healthy and your development context persistent across any IDE.</p>

      <h3>What is Neural Commander?</h3>
      <ul>
        <li>🔍 <strong>Project Health Scanner</strong> — Know your project's health in 30 seconds</li>
        <li>🧠 <strong>Persistent Context</strong> — Never lose your development state</li>
        <li>🔧 <strong>Works with Any IDE</strong> — VS Code, Cursor, JetBrains, Neovim</li>
        <li>🏠 <strong>Local-First</strong> — Your data stays on your machine</li>
      </ul>

      <div class="referral-box">
        <p style="margin: 0; font-size: 14px; color: #666;">Your referral code</p>
        <p style="margin: 5px 0; font-size: 24px; font-weight: bold; color: #4a9eff; font-family: monospace;">${referralCode}</p>
        <p style="margin: 0; font-size: 12px; color: #666;">Use this when you sign up to credit ${referrerName}</p>
      </div>

      <p style="text-align: center;">
        <a href="https://neuralcommander.ai/waitlist?ref=${referralCode}" class="button">Join the Waitlist Free</a>
      </p>

      <p>The Community Edition is <strong>free forever</strong>. Or join Foundation 100 for lifetime Pro access at $97.</p>

      <p>— The Neural Commander Team</p>
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

function getReferrerConfirmationEmail(referrerName: string, friendName: string, counterpartyAddress?: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981, #4a9eff); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; }
    .reward-box { background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; }
    .token-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Invite Sent!</h1>
    </div>
    <div class="content">
      <p>Hey ${referrerName},</p>
      <p>Great news! We've sent your invite to <strong>${friendName}</strong>. Here's what happens next:</p>

      <div class="reward-box">
        <h3 style="margin-top: 0; color: #10b981;">Your Potential Rewards</h3>
        <ul style="margin-bottom: 0;">
          <li><strong>1 month free</strong> — when ${friendName} starts a trial</li>
          <li><strong>+1 month free</strong> — if they upgrade to Pro monthly</li>
          <li><strong>+2 months free</strong> — if they go Pro annual</li>
        </ul>
      </div>

      ${counterpartyAddress ? `
      <div class="token-box">
        <h3 style="margin-top: 0; color: #f59e0b;">GIVEKUDOS Token Reward</h3>
        <p style="margin-bottom: 0;">When ${friendName} joins the <strong>Community Edition</strong>, we'll send <strong>10,000 GIVEKUDOS</strong> tokens to your Counterparty address:</p>
        <p style="font-family: monospace; word-break: break-all; font-size: 12px; background: #fff; padding: 8px; border-radius: 4px;">${counterpartyAddress}</p>
      </div>
      ` : `
      <p style="color: #666; font-size: 14px;"><em>Tip: Add your Counterparty address next time to earn 10,000 GIVEKUDOS tokens when friends join!</em></p>
      `}

      <p>Want to refer more friends? The more you refer, the more free months you earn!</p>

      <p>Thanks for spreading the word!</p>
      <p>— The Neural Commander Team</p>
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
