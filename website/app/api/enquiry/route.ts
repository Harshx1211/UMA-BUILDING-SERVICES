import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use server-side Supabase with anon key — enquiries table is public insert
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { name, company, email, phone, service_type, property_address, message } = body;

    // Basic validation
    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Name, email and message are required.' }, { status: 400 });
    }

    // Email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    // Insert into the database as a platform-level lead (company_id is null)
    // The RLS policy "enquiries_public_insert" allows anon inserts.
    const { error } = await supabase.from('enquiries').insert([{
      company_id: null, // Indicates a SaaS lead, not a tenant lead
      name,
      email,
      phone,
      service: service_type || 'Platform Demo Request',
      message: `${company ? `Company: ${company}\n` : ''}${property_address ? `Property: ${property_address}\n` : ''}Message: ${message}`,
      status: 'new',
    }]);

    if (error) {
      console.error('Failed to insert SaaS lead:', error);
      return NextResponse.json({ error: 'Failed to submit enquiry.' }, { status: 500 });
    }

    console.log('[SaaS Lead Captured in DB]:', { name, email, phone });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('Enquiry API error:', err);
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
