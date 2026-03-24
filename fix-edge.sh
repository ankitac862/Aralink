const fs = require('fs');
let content = fs.readFileSync('supabase/functions/send-lease/index.ts', 'utf8');
content = content.replace(/properties:property_id \(/g, 'properties (');
fs.writeFileSync('supabase/functions/send-lease/index.ts', content);
