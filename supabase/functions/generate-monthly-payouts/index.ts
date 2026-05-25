import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Runs automatically on the last day of each month via Supabase cron.
// Also callable manually by admin for testing.
serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // The payout month = the current month (first day of month)
    const now = new Date();
    const payoutMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];

    // Fetch all approved referrals that have a subscription fee
    const { data: referrals, error: refErr } = await supabase
      .from('referrals')
      .select(`
        id,
        ara_partner_id,
        subscription_fee,
        commission_rules (
          id,
          commission_percent,
          start_date,
          end_date
        ),
        ara_partners (
          id,
          payment_method,
          etransfer_id,
          bank_transit,
          bank_routing,
          bank_account
        )
      `)
      .eq('status', 'approved')
      .not('subscription_fee', 'is', null);

    if (refErr) throw refErr;

    let generated = 0;
    let skipped = 0;

    for (const referral of referrals || []) {
      // Find the active commission rule for this payout month
      const activeRule = (referral.commission_rules || []).find((rule: any) => {
        const start = new Date(rule.start_date);
        const end = rule.end_date ? new Date(rule.end_date) : null;
        const monthStart = new Date(payoutMonth);
        return start <= monthStart && (end === null || end >= monthStart);
      });

      if (!activeRule) {
        skipped++;
        continue;
      }

      const partner = referral.ara_partners as any;
      if (!partner) {
        skipped++;
        continue;
      }

      const amount = (referral.subscription_fee * activeRule.commission_percent) / 100;

      const bankDetailsSnapshot =
        partner.payment_method === 'bank'
          ? {
              transit: partner.bank_transit,
              routing: partner.bank_routing,
              account: partner.bank_account,
            }
          : null;

      // Insert payout record — skip if already exists for this referral+month (unique constraint)
      const { error: insertErr } = await supabase.from('payout_records').insert({
        ara_partner_id: referral.ara_partner_id,
        referral_id: referral.id,
        payout_month: payoutMonth,
        subscription_fee_snapshot: referral.subscription_fee,
        commission_percent_snapshot: activeRule.commission_percent,
        amount,
        payment_method_snapshot: partner.payment_method,
        etransfer_id_snapshot: partner.etransfer_id || null,
        bank_details_snapshot: bankDetailsSnapshot,
        status: 'pending',
      });

      if (insertErr) {
        if (insertErr.code === '23505') {
          // Already generated for this month — skip silently
          skipped++;
        } else {
          console.error('Error inserting payout for referral', referral.id, insertErr);
          skipped++;
        }
        continue;
      }

      generated++;
    }

    return new Response(
      JSON.stringify({ success: true, payout_month: payoutMonth, generated, skipped }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('generate-monthly-payouts error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
