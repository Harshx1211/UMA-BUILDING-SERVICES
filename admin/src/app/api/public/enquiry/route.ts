import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Handle preflight requests for CORS (so tenants can embed the form on any domain)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// Public endpoint to capture customer leads for a specific tenant
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { company_id, name, email, phone, service, message } = body;

    if (!company_id || !name || !email || !message) {
      return NextResponse.json(
        { error: 'Missing required fields (company_id, name, email, message)' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Insert directly using service role to bypass RLS (since this is an unauthenticated public route)
    // The company_id parameter ensures the lead is correctly routed to the tenant's dashboard.
    const { error } = await supabaseAdmin.from('enquiries').insert({
      company_id,
      name,
      email,
      phone: phone || null,
      service: service || 'General Enquiry',
      message,
      status: 'new'
    });

    if (error) {
      console.error('[Public Enquiry API] Error:', error);
      return NextResponse.json(
        { error: 'Failed to submit enquiry.' },
        { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Enquiry submitted successfully.' },
      { status: 201, headers: { 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (err: any) {
    return NextResponse.json(
      { error: 'Invalid request payload.' },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
