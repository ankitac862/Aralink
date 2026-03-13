/**
 * Supabase Edge Function: Send Lease to Tenant
 * 
 * Sends the generated/uploaded lease document to the tenant via:
 * - Email (with download link or attachment)
 * - In-app notification
 * 
 * Updates lease status to 'sent'
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface SendLeaseRequest {
  leaseId: string;
  tenantEmail?: string; // Override email if different from tenant profile
  sendEmail?: boolean; // Default true
  sendNotification?: boolean; // Default true
  message?: string; // Optional custom message
}

interface SendLeaseResponse {
  success: boolean;
  status?: string;
  emailSent?: boolean;
  notificationSent?: boolean;
  error?: string;
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Email service configuration
const emailServiceUrl = Deno.env.get('EMAIL_SERVICE_URL'); // e.g., Resend, SendGrid
const emailApiKey = Deno.env.get('EMAIL_API_KEY');
const fromEmail = Deno.env.get('FROM_EMAIL') || 'noreply@aaralink.com';

/**
 * Sends email notification to tenant
 */
async function sendEmailNotification(
  tenantEmail: string,
  tenantName: string,
  landlordName: string,
  propertyAddress: string,
  documentUrl: string,
  customMessage?: string
): Promise<boolean> {
  if (!emailServiceUrl || !emailApiKey) {
    console.log('Email service not configured');
    return false;
  }
  
  try {
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Lease Agreement is Ready</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #137fec 0%, #0066cc 100%);
      color: white;
      padding: 30px;
      border-radius: 12px 12px 0 0;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      background: #ffffff;
      padding: 30px;
      border: 1px solid #e5e7eb;
      border-top: none;
      border-radius: 0 0 12px 12px;
    }
    .property-card {
      background: #f9fafb;
      padding: 16px;
      border-radius: 8px;
      margin: 20px 0;
      border-left: 4px solid #137fec;
    }
    .button {
      display: inline-block;
      background: #137fec;
      color: white;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
    }
    .button:hover {
      background: #0066cc;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #6b7280;
      font-size: 14px;
    }
    .message-box {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📄 Your Lease Agreement is Ready</h1>
  </div>
  
  <div class="content">
    <p>Dear ${tenantName || 'Tenant'},</p>
    
    <p>${landlordName} has sent you a lease agreement for review.</p>
    
    <div class="property-card">
      <strong>Property:</strong><br>
      ${propertyAddress}
    </div>
    
    ${customMessage ? `
    <div class="message-box">
      <strong>Message from your landlord:</strong><br>
      ${customMessage}
    </div>
    ` : ''}
    
    <p>Please review the lease agreement carefully. You can view and download the document using the button below:</p>
    
    <center>
      <a href="${documentUrl}" class="button">View Lease Agreement</a>
    </center>
    
    <p>If you have any questions about the lease terms, please contact your landlord directly.</p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="font-size: 14px; color: #6b7280;">
      <strong>Important:</strong> This lease is governed by the Ontario Residential Tenancies Act, 2006.
      For information about your rights as a tenant, visit the Landlord and Tenant Board website.
    </p>
  </div>
  
  <div class="footer">
    <p>Sent via Aaralink Property Management</p>
    <p>© ${new Date().getFullYear()} Aaralink. All rights reserved.</p>
  </div>
</body>
</html>
    `;
    
    const response = await fetch(emailServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${emailApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: tenantEmail,
        subject: `Lease Agreement Ready for Review - ${propertyAddress}`,
        html: emailHtml,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Email send error:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

/**
 * Creates in-app notification for tenant
 */
async function createInAppNotification(
  tenantId: string,
  leaseId: string,
  landlordName: string,
  propertyAddress: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: tenantId,
        type: 'lease_received',
        title: 'New Lease Agreement',
        message: `${landlordName} has sent you a lease agreement for ${propertyAddress}`,
        data: {
          lease_id: leaseId,
          action: 'view_lease',
        },
        is_read: false,
        created_at: new Date().toISOString(),
      });
    
    if (error) {
      // If notifications table doesn't exist, just log and continue
      if (error.code === 'PGRST205') {
        console.log('Notifications table not set up');
        return true; // Not a failure, just not configured
      }
      console.error('Error creating notification:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error creating notification:', error);
    return false;
  }
}

// Main request handler
serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const body: SendLeaseRequest = await req.json();
    const {
      leaseId,
      tenantEmail: overrideEmail,
      sendEmail = true,
      sendNotification = true,
      message,
    } = body;
    
    if (!leaseId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing leaseId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Fetch lease with property info (but not tenant - it might be null for applicants)
    const { data: lease, error: leaseError } = await supabase
      .from('leases')
      .select(`
        *,
        properties:property_id (
          address,
          city,
          state,
          zip_code
        )
      `)
      .eq('id', leaseId)
      .single();
    
    if (leaseError || !lease) {
      console.error('Lease fetch error:', leaseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Lease not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Fetch tenant or applicant info separately
    let recipientEmail = overrideEmail;
    let recipientName = 'Tenant';
    let recipientId: string | null = null;
    
    if (lease.tenant_id) {
      // This is for an existing tenant
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, first_name, last_name, email')
        .eq('id', lease.tenant_id)
        .single();
      
      if (tenant) {
        recipientEmail = recipientEmail || tenant.email;
        recipientName = `${tenant.first_name} ${tenant.last_name}`;
        recipientId = tenant.id;
      }
    } else if (lease.application_id) {
      // This is for an applicant
      const { data: application } = await supabase
        .from('applications')
        .select('id, applicant_name, applicant_email, user_id')
        .eq('id', lease.application_id)
        .single();
      
      if (application) {
        recipientEmail = recipientEmail || application.applicant_email;
        recipientName = application.applicant_name;
        recipientId = application.user_id;
      }
    }
    
    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ success: false, error: 'No recipient email found. Please provide an email address.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Verify user owns this lease
    if (lease.user_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized to send this lease' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check lease has a document
    if (!lease.document_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'Lease has no document. Generate or upload a document first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get property address
    const property = lease.properties;
    const propertyAddress = property
      ? `${property.address}, ${property.city}, ${property.state} ${property.zip_code}`
      : 'Property Address';
    
    // Get landlord info
    const { data: landlordProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();
    
    const landlordName = landlordProfile?.full_name || 'Your Landlord';
    
    let emailSent = false;
    let notificationSent = false;
    
    // Send email if enabled and email is available
    if (sendEmail && recipientEmail) {
      emailSent = await sendEmailNotification(
        recipientEmail,
        recipientName,
        landlordName,
        propertyAddress,
        lease.document_url,
        message
      );
    }
    
    // Create in-app notification if enabled and recipient ID is available
    if (sendNotification && recipientId) {
      notificationSent = await createInAppNotification(
        recipientId,
        leaseId,
        landlordName,
        propertyAddress
      );
    }
    
    // Update lease status to 'sent'
    const { error: updateError } = await supabase
      .from('leases')
      .update({
        status: 'sent',
        updated_at: new Date().toISOString(),
      })
      .eq('id', leaseId);
    
    if (updateError) {
      console.error('Error updating lease status:', updateError);
    }
    
    const response: SendLeaseResponse = {
      success: true,
      status: 'sent',
      emailSent,
      notificationSent,
    };
    
    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected error occurred',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
