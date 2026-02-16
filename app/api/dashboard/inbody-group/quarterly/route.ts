// app/api/dashboard/inbody-group/quarterly/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');

    if (!year) {
      return NextResponse.json(
        { error: 'Year parameter is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const yearInt = parseInt(year);
    const prevYear = yearInt - 1;

    const { data, error } = await supabase.rpc('get_inbody_group_quarterly', {
      p_year: yearInt,
      p_prev_year: prevYear,
    });

    if (error) {
      console.error('InBody Group Quarterly RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch quarterly data', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('InBody Group Quarterly API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quarterly data', details: (error as Error).message },
      { status: 500 }
    );
  }
}

