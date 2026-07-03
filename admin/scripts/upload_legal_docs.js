const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadDocs() {
  const bucketName = 'legal';

  // 1. Check if bucket exists, create if not
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error("Error listing buckets:", listError.message);
    return;
  }

  const legalBucket = buckets.find(b => b.name === bucketName);
  if (!legalBucket) {
    console.log(`Creating public bucket '${bucketName}'...`);
    const { error: createError } = await supabase.storage.createBucket(bucketName, { public: true });
    if (createError) {
      console.error("Error creating bucket:", createError.message);
      return;
    }
  } else if (!legalBucket.public) {
      console.log(`Bucket '${bucketName}' exists but is not public. Please make it public in dashboard.`);
  }

  // 2. Upload files
  const docsDir = path.join(__dirname, '../../Legal Documents');
  const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.doc'));

  for (const file of files) {
    const filePath = path.join(docsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // We change the extension to .html so the browser renders it automatically instead of downloading
    const uploadName = file.replace('.doc', '.html');
    
    console.log(`Uploading ${uploadName}...`);
    
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(uploadName, content, {
        contentType: 'text/html',
        upsert: true
      });

    if (uploadError) {
      console.error(`Error uploading ${uploadName}:`, uploadError.message);
    } else {
      console.log(`Successfully uploaded ${uploadName}`);
    }
  }

  console.log("All legal documents uploaded successfully!");
}

uploadDocs();
