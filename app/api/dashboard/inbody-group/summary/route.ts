// app/api/dashboard/inbody-group/summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');
    const quarter = searchParams.get('quarter') || 'All';

    if (!year) {
      return NextResponse.json(
        { error: 'Year parameter is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const yearInt = parseInt(year);
    const prevYear = yearInt - 1;

    // Call RPC function for InBody Group summary with KRW conversion
    const { data, error } = await supabase.rpc('get_inbody_group_summary', {
      p_year: yearInt,
      p_prev_year: prevYear,
      p_quarter: quarter === 'All' ? null : quarter,
    });

    if (error) {
      console.error('InBody Group Summary RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch InBody Group summary', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('InBody Group Summary API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch InBody Group summary', details: (error as Error).message },
      { status: 500 }
    );
  }
}

