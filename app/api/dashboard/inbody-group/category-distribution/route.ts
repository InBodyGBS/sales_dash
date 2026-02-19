// app/api/dashboard/inbody-group/category-distribution/route.ts
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
    const monthInt = month ? parseInt(month) : null;

    const { data, error } = await supabase.rpc('get_inbody_group_category_distribution', {
      p_year: yearInt,
      p_quarter: quarter === 'All' ? null : quarter,
      p_month: monthInt,
    });

    if (error) {
      console.error('InBody Group Category Distribution RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch category distribution', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('InBody Group Category Distribution API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch category distribution', details: (error as Error).message },
      { status: 500 }
    );
  }
}

