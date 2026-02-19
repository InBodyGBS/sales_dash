// app/api/dashboard/inbody-group/monthly-trend/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');
    const quarter = searchParams.get('quarter') || 'All';
    const month = searchParams.get('month');

    if (!year) {
      return NextResponse.json(
        { error: 'Year parameter is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const yearInt = parseInt(year);
    const prevYear = yearInt - 1;
    const monthInt = month ? parseInt(month) : null;

    const { data, error } = await supabase.rpc('get_inbody_group_monthly_trend', {
      p_year: yearInt,
      p_prev_year: prevYear,
      p_quarter: quarter === 'All' ? null : quarter,
      p_month: monthInt,
    });

    if (error) {
      console.error('InBody Group Monthly Trend RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch monthly trend', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('InBody Group Monthly Trend API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monthly trend', details: (error as Error).message },
      { status: 500 }
    );
  }
}

