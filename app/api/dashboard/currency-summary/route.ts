import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');
    const entity = searchParams.get('entity');

    if (!year || !entity) {
      return NextResponse.json(
        { error: 'Year and entity parameters are required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const yearInt = parseInt(year);
    const prevYear = yearInt - 1;

    if (isNaN(yearInt)) {
      return NextResponse.json(
        { error: 'Invalid year parameter' },
        { status: 400 }
      );
    }

    console.log(`📊 Currency summary API - Fetching for entity: ${entity}, year: ${yearInt}`);
    
    // Get currency breakdown for current year
    const { data: currentYearData, error: currentError } = await supabase
      .from('mv_sales_cube')
      .select('currency, line_amount_mst')
      .eq('entity', entity)
      .eq('year', yearInt)
      .not('line_amount_mst', 'is', null);

    if (currentError) {
      console.error('❌ Currency summary API error:', currentError);
      return NextResponse.json(
        { error: 'Failed to fetch currency summary', details: currentError.message },
        { status: 500 }
      );
    }

    console.log(`✅ Currency summary API - Current year data count: ${currentYearData?.length || 0}`);

    // Get currency breakdown for previous year
    const { data: prevYearData, error: prevError } = await supabase
      .from('mv_sales_cube')
      .select('currency, line_amount_mst')
      .eq('entity', entity)
      .eq('year', prevYear)
      .not('line_amount_mst', 'is', null);

    if (prevError) {
      console.error('Currency summary API error (prev year):', prevError);
    }

    // Aggregate by currency
    const currencyMap = new Map<string, { current: number; previous: number }>();

    // Process current year data
    if (currentYearData) {
      currentYearData.forEach((row) => {
        const currency = row.currency || 'Unknown';
        const amount = parseFloat(row.line_amount_mst || '0') || 0;
        
        if (!currencyMap.has(currency)) {
          currencyMap.set(currency, { current: 0, previous: 0 });
        }
        currencyMap.get(currency)!.current += amount;
      });
    }

    // Process previous year data
    if (prevYearData) {
      prevYearData.forEach((row) => {
        const currency = row.currency || 'Unknown';
        const amount = parseFloat(row.line_amount_mst || '0') || 0;
        
        if (!currencyMap.has(currency)) {
          currencyMap.set(currency, { current: 0, previous: 0 });
        }
        currencyMap.get(currency)!.previous += amount;
      });
    }

    // Convert to array and calculate comparisons
    const currencyBreakdown = Array.from(currencyMap.entries())
      .map(([currency, data]) => {
        const amountChange = data.previous > 0
          ? ((data.current - data.previous) / data.previous) * 100
          : 0;

        return {
          currency,
          currentAmount: data.current,
          previousAmount: data.previous,
          comparison: {
            amount: amountChange,
          },
        };
      })
      .sort((a, b) => b.currentAmount - a.currentAmount); // Sort by current amount descending

    console.log(`✅ Currency summary API - Currency breakdown:`, currencyBreakdown);

    return NextResponse.json({
      currencyBreakdown,
    });
  } catch (error) {
    console.error('Currency summary API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch currency summary', details: (error as Error).message },
      { status: 500 }
    );
  }
}
