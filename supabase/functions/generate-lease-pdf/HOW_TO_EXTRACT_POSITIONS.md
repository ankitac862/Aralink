# How to Extract Field Positions from Your PDF Template

Since I don't have access to your `2229e_standard-lease_static.pdf` file, here are the methods YOU can use to get the exact positions.

---

## Method 1: Use PDF.co Info API (Recommended - Automated)

If your template already has form fields, PDF.co can extract them automatically.

### Step 1: Get Field Information

```bash
# Replace with your actual values
PDFCO_API_KEY="your_api_key"
TEMPLATE_URL="https://your-storage.com/2229e_standard-lease_static.pdf"

# Call PDF.co Info API
curl -X POST "https://api.pdf.co/v1/pdf/info" \
  -H "x-api-key: $PDFCO_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"$TEMPLATE_URL\"
  }"
```

### Step 2: Parse the Response

The response will show all existing form fields with their coordinates:

```json
{
  "fields": [
    {
      "fieldName": "Landlord_Name",
      "x": 120,
      "y": 150,
      "width": 200,
      "height": 20,
      "page": 0
    },
    // ... more fields
  ]
}
```

### Step 3: Copy Coordinates

Use these coordinates directly in your `index.ts` file.

---

## Method 2: Use PDF.co API Tester (Visual - Easiest)

This is the EASIEST method if you prefer visual editing.

### Steps:

1. Go to **https://apitester.com/shared/checks/1d0a628c6fc34d4f9f7e8e0b68cbf0c9** (PDF.co API Tester)
   
   OR
   
   Go to https://pdf.co/ → Click **"API"** → **"Try it"** → Select **"PDF Edit Add"**

2. Upload your `2229e_standard-lease_static.pdf` in the URL field

3. In the "Annotations" section, you can add test text to see coordinates

4. Click **"Run"** to see the preview

5. Adjust X, Y values until text appears in the right spot

6. Note down the working coordinates

**Alternative: Use PDF Coordinate Tools**

- **PDF Coordinate Finder**: https://pdfslick.dev/ (shows coordinates on click)
- **Sejda PDF Editor**: https://www.sejda.com/pdf-editor (free, shows coordinates)
- **Adobe Online**: https://www.adobe.com/acrobat/online/edit-pdf.html (if you have account)

---

## Method 3: Use Adobe Acrobat (If You Have It)

### Steps:

1. Open your PDF in Adobe Acrobat

2. Go to **Tools** → **Measure** → **Point**

3. Click on the location where you want text

4. Note the X, Y coordinates shown

5. **Important:** PDF.co uses top-left origin, Adobe uses bottom-left
   - Convert Y coordinate: `Y_pdfco = 792 - Y_adobe` (for Letter size)

---

## Method 4: Trial and Error (Manual but Works)

This is what most people do - it's actually quite fast.

### Process:

1. **Start with estimated positions** (use the template I provided)

2. **Deploy and test:**
   ```bash
   supabase functions deploy generate-lease-pdf
   # Generate test PDF
   ```

3. **Measure offset:**
   - If text appears 20 points to the right → subtract 20 from X
   - If text appears 30 points below → subtract 30 from Y

4. **Adjust and repeat**

5. **Usually takes 3-5 iterations to get perfect**

---

## Method 5: I'll Help You Create a Position Finder Script

Let me create a Node.js script you can run to extract positions:

```javascript
// extract-positions.js
const https = require('https');

const PDFCO_API_KEY = 'your_api_key_here';
const TEMPLATE_URL = 'https://your-storage.com/2229e_standard-lease_static.pdf';

async function extractPositions() {
  const data = JSON.stringify({
    url: TEMPLATE_URL
  });

  const options = {
    hostname: 'api.pdf.co',
    path: '/v1/pdf/info',
    method: 'POST',
    headers: {
      'x-api-key': PDFCO_API_KEY,
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Run it
extractPositions()
  .then(result => {
    console.log('\n=== PDF FIELD INFORMATION ===\n');
    
    if (result.fields && result.fields.length > 0) {
      console.log('Found', result.fields.length, 'fields:\n');
      
      result.fields.forEach((field, index) => {
        console.log(`Field ${index + 1}:`);
        console.log(`  Name: ${field.fieldName}`);
        console.log(`  Position: x: ${field.x}, y: ${field.y}`);
        console.log(`  Size: ${field.width} × ${field.height}`);
        console.log(`  Page: ${field.page}`);
        console.log('');
      });
      
      // Generate code snippet
      console.log('\n=== CODE FOR index.ts ===\n');
      result.fields.forEach(field => {
        console.log(`annotations.push({`);
        console.log(`  x: ${field.x},`);
        console.log(`  y: ${field.y},`);
        console.log(`  text: formData.someField, // Update this`);
        console.log(`  fontName: "Helvetica",`);
        console.log(`  fontSize: 10,`);
        console.log(`  pages: "${field.page}"`);
        console.log(`});\n`);
      });
    } else {
      console.log('No form fields found in PDF.');
      console.log('You will need to manually determine positions.');
    }
    
    console.log('\n=== PDF INFORMATION ===');
    console.log('Pages:', result.pageCount || 'Unknown');
    console.log('Page size:', result.pageWidth, '×', result.pageHeight, 'points');
  })
  .catch(error => {
    console.error('Error:', error.message);
  });
```

### How to use the script:

```bash
# Save the script
cat > extract-positions.js << 'EOF'
# [paste the script above]
EOF

# Update your API key and URL in the script
nano extract-positions.js

# Run it
node extract-positions.js
```

---

## Method 6: Use Online PDF Coordinate Finder

1. Go to https://pdfkit.org/demo/browser.html
2. Upload your PDF
3. Click to see coordinates
4. Note them down

---

## Quick Start - Recommended Approach

**For fastest results, use Method 2 (PDF.co Playground):**

1. Go to https://pdf.co/playground
2. Select "PDF Edit Add"
3. Upload your template
4. Click where you want each field
5. Copy the X, Y coordinates
6. Update `index.ts` with these values

**This should take 15-30 minutes for all fields.**

---

## What Coordinates Do You Need?

Here's a checklist of all positions you need to find:

### Page 1 (Section 1-3)
- [ ] Landlord 1 name: x: ___, y: ___
- [ ] Landlord 2-4 names (if space): x: ___, y: ___
- [ ] Tenant 1 name: x: ___, y: ___
- [ ] Tenant 2-12 names grid: starting x: ___, y: ___
- [ ] Unit number: x: ___, y: ___
- [ ] Street number: x: ___, y: ___
- [ ] Street name: x: ___, y: ___
- [ ] City: x: ___, y: ___
- [ ] Province: x: ___, y: ___
- [ ] Postal code: x: ___, y: ___
- [ ] Parking: x: ___, y: ___
- [ ] Condo checkbox: x: ___, y: ___
- [ ] Notice address: x: ___, y: ___
- [ ] Email consent checkbox: x: ___, y: ___
- [ ] Emails: x: ___, y: ___
- [ ] Emergency contact: x: ___, y: ___

### Page 2 (Section 4-5)
- [ ] Start date: x: ___, y: ___
- [ ] Term type checkboxes: x: ___, y: ___
- [ ] End date: x: ___, y: ___
- [ ] Rent due day: x: ___, y: ___
- [ ] Base rent: x: ___, y: ___
- [ ] Parking rent: x: ___, y: ___
- [ ] Other services: x: ___, y: ___
- [ ] Total rent: x: ___, y: ___
- [ ] Payable to: x: ___, y: ___
- [ ] Payment methods: x: ___, y: ___

### Page 3-6 (Sections 6-15)
- [ ] Utilities checkboxes
- [ ] Services checkboxes
- [ ] Discounts
- [ ] Deposits
- [ ] Smoking rules
- [ ] Insurance checkbox
- [ ] Additional terms

### Page 7 (Section 17 - Signatures)
- [ ] Landlord signature area: x: ___, y: ___
- [ ] Tenant signature area: x: ___, y: ___

---

## Need Help?

1. **Can't find positions?** Use Method 2 (PDF.co Playground) - it's visual and easy

2. **Don't have PDF.co account yet?** Sign up at https://pdf.co (free tier available)

3. **Template has no form fields?** Use Method 2 or Method 4 (trial and error)

4. **Want me to help?** Share your template URL (if it's publicly accessible) and I can help analyze it

---

## After You Get the Positions

1. **Update `index.ts`** with the coordinates
2. **Deploy:**
   ```bash
   supabase functions deploy generate-lease-pdf
   ```
3. **Test** with sample data
4. **Adjust** if needed
5. **Repeat** until perfect

---

**Recommended:** Start with Method 2 (PDF.co Playground) - it's the easiest and most visual approach!
