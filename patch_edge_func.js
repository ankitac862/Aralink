const fs = require('fs');
const file = 'supabase/functions/send-lease/index.ts';
let data = fs.readFileSync(file, 'utf8');

const targetBlock = `    // 1. Check if user exists as an active Tenant (by email) under this landlord
    const { data: tenantFound } = await supabase
      .from('tenants')
      .select('id, first_name, last_name, user_id')
      .eq('email', finalTargetEmail)
      // Check if the tenant actually belongs to this landlord's group... if landlord id check fails, we fallback to general tenant check.
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tenantFound) {
      // User is an existing Tenant! Update role mapping.
      recipientName = \`\${tenantFound.first_name || ''} \${tenantFound.last_name || ''}\`.trim() || 'Tenant';
      recipientId = tenantFound.user_id;
      updatesToLease.tenant_id = tenantFound.id;
      lease.tenant_id = tenantFound.id;
      
      // DO NOT clear application_id - keep bconst fs = require('fs');
const fhiconst file = 'supabase/f ilet data = fs.readFileSync(file, 'utf8');

const targda
const targetBlock = `    // 1. Check ifnd.    const { data: tenantFound } = await supabase
      .from('tenants')
      .select('id, first_namepi      .from('tenants')
      .select('id, first}      {
      // 2. Chec      .eq('email', finalTargetEmail)
      // Chec{       // Check if the tenant actualba      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tenantFound) {
      // User is an existi.o      .limit(1)
      .maybeSingle();

    if (        .maybeSi  
    if (tenantFound         // User is an e {      recipientName = \`\${tenantFound.first_name || ''}=       recipientId = tenantFound.user_id;
      updatesToLease.tenant_id = tenantFound.id;
      lease.tenant_on      updatesToLease.tenant_id = tenantap      lease.tenant_id = tenantFound.id;
      
le      
      // DO NOT clear applicatiic     , const fhiconst file = 'supabase/f ilet data = fs.readFileSync(file, 'at
const targda
const targetBlock = `    // 1. Check ifnd.    const { data: tnviconst targery      .from('tenants')
      .select('id, first_namepi      .from('tenants')
      .selecap      .select('id, fiAp      .select('id, first}      {
      // 2. Chec   .f      // 2. Chec      .eq('emait(      // Chec{       // Check if the tenant actualber      .limit(1)
      .maybeSingle();

    if (tenantFound) {
      // User is an existi.o      .lifo      .maybeSitN
    if (tenantFoundcti      // User is an e s      .maybeSingle();

    if (        .maok
    if (        .ma       if (tenantFound      le      updatesToLease.tenant_id = tenantFound.id;
      lease.tenant_on      updatesToLease.tenant_id = tenantap      lease.tenant_id = tenantF u      lease.tenant_on      updatesToLease.tenanda      
le      
      // DO NOT clear applicatiic     , const fhiconst file = 'supabase/f ilet data isle   li      /
 const targda
const tantFound } = await supabase
      .from('tenants')
      .select('id, first_name, last_name,const targe        .select('id, first_namepi      .from('tenants')
      .selecap      .select('id, fiAp      .)
      .selecap      .select('id, fiAp      .select('un      // 2. Chec  se
      .from('applications')
      .select('id, applicant_name, user_id')
      .eq('applicant_email', finalTargetEmail)
      .order('created_at', { ascending: false })
   
  .limit(1)
      .may      // User is an eap    if (tenantFoundcti      // User is an e s      .mapd
    if (        .maok
    if (        .ma       if (tenantFound cat    if (        .ma un      lease.tenant_on      updatesToLease.tenant_id = tenantap      lease.tenant_id = tenantF u _nle      
      // DO NOT clear applicatiic     , const fhiconst file = 'supabase/f ilet data isle   li      /
 const targda
const tantFound } = awaitas      /t_ const targda
const tantFound } = await supabase
      .from('tenants')
      .select('id, first_naenconst tantFo{t      .from('tenants')
      .selen      .select('id, fi '      .selecap      .select('id, fiAp      .)
      .selecap      .select('id, fiAp      .select('un      st      .selecap      .select('id, fiAp      .        .from('applications')
      .select('id, applicant_name, user_id')
 Recipient not found in tenant      .eq('applicant_email', finalTargetEmaat      .order('created_at', { ascending: falseen   
  .limit(1)
      .may      // User is an eal  rg      .may      if (        .maok
    if (        .ma       if (tenantFound cat    if (        .ma u      if (        .ma e.      // DO NOT clear applicatiic     , const fhiconst file = 'supabase/f ilet data isle   li      /
 const targda
const tantFound } = awaitas      /t_ const targda
const tme const targda
const tantFound } = awaitas      /t_ const targda
const tantFound } = await supabase
data);
