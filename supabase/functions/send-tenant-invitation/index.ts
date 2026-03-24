/**
 * Supabase Edge Function: Send Tenant Invitation
 * 
 * Sends an invitation email to an applicant so they can activate their tenant account
 * with a custom password and login credentials.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface SendTenantInvitationRequest {
  email: string;
  tenantName: string;
  activationLink: string;
  propertyName: string;
  landlordName: string;
}

interface SendTenantInvitationResponse {
  success: boolean;
  message?: string;
  error?: string;
  emailSent?: boolean;
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Email service configuration
const resendApiKey = Deno.env.get('RESEND_API_KEY');
const fromEmail = Deno.env.get('FROM_EMAIL') || 'noreply@aaralink.com';

/**
 * Sends invitation email using Resend
 */
async function sendEmailViaResend(
  tenantEmail: string,
  tenantName: string,
  activationLink: string,
  propertyName: string,
  landlordName: string
): Promise<boolean> {
  if (!resendApiKey) {
    console.error('❌ RESEND_API_KEY not configured');
    return false;
  }

  try {
    const emailContent = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Activate Your Aaralink Tenant Account</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; color: #333; line-height: 1.6; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #2A64F5; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
      .header h1 { margin: 0; font-size: 24px; }
      .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
      .content p { margin: 15px 0; }
      .property-info { background-color: white; padding: 15px; border-left: 4px solid #2A64F5; margin: 20px 0; border-radius: 4px; }
      .property-info strong { color: #2A64F5; }
      .button { display: inline-block; background-color: #2A64F5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
      .button:hover { background-color: #1e50cc; }
      .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      .link-info { background-color: #f0f4ff; padding: 15px; border-radius: 6px; margin: 20px 0; }
      .link-info p { margin: 8px 0; font-size: 13px; color: #555; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Welcome to Aaralink!</h1>
      </div>
      <div class="content">
        <p>Hello <strong>${tenantName}</strong>,</p>
        
        <p>Your landlord, <strong>${landlordName}</strong>, has invited you to manage your rental property information on Aaralink.</p>
        
        <div class="property-info">
          <strong>🏠 Property:</strong> ${propertyName}
        </div>
        
        <p>Click the button below to activate your account and set your password:</p>
        
        <div style="text-align: center;">
          <a href="${activationLink}" class="button">Activate My Account</a>
        </div>
        
        <div class="link-info">
          <p><strong>Link expires in:</strong> 30 days</p>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; font-family: monospace; font-size: 12px;"><a href="${activationLink}" style="color: #2A64F5;">${activationLink}</a></p>
        </div>
        
        <p>Once activated, you'll be able to:</p>
        <ul>
          <li>View your lease agreement</li>
          <li>Track maintenance requests</li>
          <li>Communicate with your landlord</li>
          <li>Manage your rental payments</li>
        </ul>
        
        <p>If you have any questions, please contact your landlord directly.</p>
        
        <p>Best regards,<br><strong>The Aaralink Team</strong></p>
      </div>
      
      <div class="footer">
        <p>© 2026 Aaralink. All rights reserved.<br>
        This is an automated message, please do not reply to this email.</p>
      </div>
    </div>
  </body>
</html>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: tenantEmail,
        subject: `Activate Your Account - ${propertyName}`,
        html: emailContent,
        reply_to: 'support@aaralink.com',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Email send failed:', error);
      return false;
    }

    console.log('✅ Email sent successfully to', tenantEmail);
    return true;
  } catch (error) {
    console.error('❌ Error sending email via Resend:', error);
    return false;
  }
}

/**
 * Main handler
 */
serve(async (req: Request) => {
  console.log(`⬅️  Received ${req.method} request`);

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const {
      email,
      tenantName,
      activationLink,
      propertyName,
      landlordName,
    }: SendTenantInvitationRequest = await req.json();

    // Validate inputs
    if (!email || !tenantName || !activationLink || !propertyName || !landlordName) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: email, tenantName, activationLink, propertyName, landlordName',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📧 Sending invitation to ${email} for property ${propertyName}`);

    // Send email
    const emailSent = await sendEmailViaResend(
      email,
      tenantName,
      activationLink,
      propertyName,
      landlordName
    );

    if (!emailSent) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to send invitation email',
          emailSent: false,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Invitation email sent successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invitation sent successfully',
        emailSent: true,
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Edge function error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
