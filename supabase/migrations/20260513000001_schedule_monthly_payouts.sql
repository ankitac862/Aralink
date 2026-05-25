-- Schedule the monthly payout generation Edge Function
-- Runs at 11:59 PM on the last day of every month (UTC)
SELECT cron.schedule(
  'generate-monthly-payouts',
  '59 23 28-31 * *',
  $$
  SELECT
    CASE WHEN (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date = now()::date
    THEN net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/generate-monthly-payouts',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    )
    END;
  $$
);
