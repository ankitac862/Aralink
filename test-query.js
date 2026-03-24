const { createClient } = require('@supabase/supabase-js');
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_APP_URL';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_APP_ANON_KEY';
const supabase = createClient(url, anonKey);

async function run() {
  const { data, error } = await supabase
    .from('leases')
    .select(`
      *,
      properties:property_id (
        address1,
        city,
        state,
        zip_code
      )
    `)
    .limit(1);
  console.log('Error:', error);
}
run();
