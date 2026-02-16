import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// GET - 모든 Exchange Rate 조회
export async function GET() {
  try {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('exchange_rate')
      .select('*')
      .order('year', { ascending: false })
      .order('currency', { ascending: true });

    if (error) {
      console.error('Failed to fetch exchange rates:', error);
      return NextResponse.json({ error: 'Failed to fetch exchange rates', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ rates: data || [] });
  } catch (error) {
    console.error('Exchange rate API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Exchange Rate 추가 (단일 또는 다중)
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const { rates } = body;

    if (!rates || !Array.isArray(rates) || rates.length === 0) {
      return NextResponse.json({ error: 'rates array is required' }, { status: 400 });
    }

    // Validate each rate
    for (const rate of rates) {
      if (!rate.year || !rate.currency || rate.rate === undefined) {
        return NextResponse.json({ error: 'Each rate must have year, currency, and rate' }, { status: 400 });
      }
    }

    // Upsert (insert or update on conflict)
    const { data, error } = await supabase
      .from('exchange_rate')
      .upsert(
        rates.map((r: any) => ({
          year: r.year,
          currency: r.currency,
          rate: r.rate,
        })),
        { onConflict: 'year,currency' }
      )
      .select();

    if (error) {
      console.error('Failed to save exchange rates:', error);
      return NextResponse.json({ error: 'Failed to save exchange rates', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: data?.length || 0 });
  } catch (error) {
    console.error('Exchange rate API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Exchange Rate 수정
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const { id, year, currency, rate } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('exchange_rate')
      .update({ year, currency, rate, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();

    if (error) {
      console.error('Failed to update exchange rate:', error);
      return NextResponse.json({ error: 'Failed to update exchange rate', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data?.[0] });
  } catch (error) {
    console.error('Exchange rate API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Exchange Rate 삭제
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('exchange_rate')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete exchange rate:', error);
      return NextResponse.json({ error: 'Failed to delete exchange rate', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Exchange rate API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
