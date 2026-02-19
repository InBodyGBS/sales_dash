import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');
    const entities = searchParams.get('entities')?.split(',').filter(Boolean) || [];

    if (!year) {
      return NextResponse.json(
        { error: 'Year parameter is required' },
        { status: 400 }
      );
    }

    const yearInt = parseInt(year);
    if (isNaN(yearInt)) {
      return NextResponse.json(
        { error: 'Invalid year parameter' },
        { status: 400 }
      );
    }

    const prevYear = yearInt - 1;
    const supabase = createServiceClient();

    // RPC 함수 호출
    const { data, error } = await supabase.rpc('get_dashboard_summary', {
      p_year: yearInt,
      p_entities: entities.length > 0 && !entities.includes('All') ? entities : null,
      p_prev_year: prevYear
    });

    if (error) {
      console.error('❌ Summary API - RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch summary', details: error.message },
        { status: 500 }
      );
    }

    // RPC 결과를 기존 API 형식으로 변환
    const currentYear = data?.current_year || {};
    const previousYear = data?.previous_year || {};

    const totalAmount = currentYear.total_amount || 0;
    const totalQty = currentYear.total_quantity || 0;
    const totalTransactions = currentYear.total_records || 0;
    const avgAmount = totalTransactions > 0 ? totalAmount / totalTransactions : 0;

    const prevTotalAmount = previousYear.total_amount || 0;
    const prevTotalQty = previousYear.total_quantity || 0;

    const amountChange = prevTotalAmount > 0 
      ? ((totalAmount - prevTotalAmount) / prevTotalAmount) * 100 
      : 0;
    const qtyChange = prevTotalQty > 0 
      ? ((totalQty - prevTotalQty) / prevTotalQty) * 100 
      : 0;

    return NextResponse.json({
      totalAmount,
      totalQty,
      avgAmount,
      totalTransactions,
      prevTotalAmount,
      prevTotalQty,
      comparison: {
        amount: amountChange,
        qty: qtyChange,
      },
    });
  } catch (error) {
    console.error('❌ Summary API - Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch summary', details: (error as Error).message },
      { status: 500 }
    );
  }
}
