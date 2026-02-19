// app/api/exchange-rate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// GET: Retrieve exchange rates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    const supabase = createServiceClient();

    let query = supabase
      .from('exchange_rate')
      .select('*')
      .order('year', { ascending: false })
      .order('currency', { ascending: true });

    if (year) {
      query = query.eq('year', parseInt(year));
    }

    const { data, error } = await query;

    if (error) {
      // If table doesn't exist, return empty array instead of error
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Exchange rate table does not exist yet. Returning empty array.');
        return NextResponse.json({
          success: true,
          rates: [],
        });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      rates: data || [],
    });
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch exchange rates',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

// POST: Create or update exchange rates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rates } = body;

    if (!rates || !Array.isArray(rates)) {
      return NextResponse.json(
        { error: 'Rates array is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Insert or update rates
    const { data, error } = await supabase
      .from('exchange_rate')
      .upsert(rates, {
        onConflict: 'year,currency',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully saved ${rates.length} exchange rates`,
      rates: data,
    });
  } catch (error) {
    console.error('Error saving exchange rates:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save exchange rates',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

// PUT: Update a single exchange rate
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, year, currency, rate } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('exchange_rate')
      .update({ year, currency, rate, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Exchange rate updated successfully',
      data: data?.[0],
    });
  } catch (error) {
    console.error('Error updating exchange rate:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update exchange rate',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

// DELETE: Delete exchange rates
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const year = searchParams.get('year');

    const supabase = createServiceClient();

    let query = supabase.from('exchange_rate').delete();

    // Delete by ID if provided, otherwise by year
    if (id) {
      query = query.eq('id', parseInt(id));
    } else if (year) {
      query = query.eq('year', parseInt(year));
    } else {
      return NextResponse.json(
        { error: 'Either id or year parameter is required' },
        { status: 400 }
      );
    }

    const { error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: id 
        ? 'Successfully deleted exchange rate'
        : `Successfully deleted rates for year ${year}`,
    });
  } catch (error) {
    console.error('Error deleting exchange rates:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete exchange rates',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

