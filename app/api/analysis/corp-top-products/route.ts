import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const entity = searchParams.get('entity');
    const year = searchParams.get('year') || '2024,2025';
    const limit = parseInt(searchParams.get('limit') || '10');

    const supabase = createServiceClient();
    const years = year.split(',').map(y => parseInt(y.trim())).filter(y => !isNaN(y));

    // Build query - use product instead of model, filter by fg_classification = 'FG'
    let query = supabase
      .from('sales_data')
      .select('entity, year, product, quantity, line_amount_mst, fg_classification')
      .neq('entity', 'HQ')
      .not('product', 'is', null)
      .eq('fg_classification', 'FG')
      .in('year', years.length > 0 ? years : [2024, 2025]);

    if (entity) {
      query = query.eq('entity', entity);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Corp Top Products API - Query error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch top products data', details: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          entities: [],
          topProducts: {},
        },
      });
    }

    // Load exchange rates for KRW conversion (same logic as Group Dashboard)
    const { data: exchangeRates } = await supabase
      .from('exchange_rate')
      .select('year, currency, rate');
    
    const { data: entityCurrencies } = await supabase
      .from('entity_currency')
      .select('entity, currency');

    const exchangeRateMap = new Map<string, number>();
    (exchangeRates || []).forEach((er: any) => {
      exchangeRateMap.set(`${er.year}_${er.currency}`, er.rate || 1);
    });

    const entityCurrencyMap = new Map<string, string>();
    (entityCurrencies || []).forEach((ec: any) => {
      entityCurrencyMap.set(ec.entity, ec.currency);
    });

    // Aggregate data by entity, year, product with KRW conversion
    const entityMap = new Map<string, Map<string, Map<string, { qty: number; amt: number }>>>();
    const entityYearTotal = new Map<string, Map<string, number>>();

    data.forEach((row) => {
      const entityName = row.entity || '';
      const yearStr = String(row.year);
      const productName = row.product || '';
      const qty = parseFloat(row.quantity) || 0;
      let amt = parseFloat(row.line_amount_mst) || 0;

      // Apply KRW conversion (same logic as Group Dashboard)
      if (entityName && !['HQ', 'Korot', 'Healthcare'].includes(entityName)) {
        const currency = entityCurrencyMap.get(entityName);
        if (currency) {
          const rate = exchangeRateMap.get(`${row.year}_${currency}`) || 1;
          amt = Math.round(amt * rate);
        }
      }

      if (!entityMap.has(entityName)) {
        entityMap.set(entityName, new Map());
        entityYearTotal.set(entityName, new Map());
      }

      const yearMap = entityMap.get(entityName)!;
      if (!yearMap.has(yearStr)) {
        yearMap.set(yearStr, new Map());
        entityYearTotal.get(entityName)!.set(yearStr, 0);
      }

      const productMap = yearMap.get(yearStr)!;
      if (!productMap.has(productName)) {
        productMap.set(productName, { qty: 0, amt: 0 });
      }

      const productData = productMap.get(productName)!;
      productData.qty += qty;
      productData.amt += amt;
      
      const yearTotal = entityYearTotal.get(entityName)!.get(yearStr)!;
      entityYearTotal.get(entityName)!.set(yearStr, yearTotal + amt);
    });

    // Convert to response format and get Top N
    const topProducts: any = {};
    const entities: string[] = [];

    entityMap.forEach((yearMap, entityName) => {
      entities.push(entityName);
      topProducts[entityName] = {};
      
      yearMap.forEach((productMap, yearStr) => {
        const yearTotal = entityYearTotal.get(entityName)!.get(yearStr) || 1;
        const products: any[] = [];

        productMap.forEach((productData, productName) => {
          const price = productData.qty > 0 ? productData.amt / productData.qty : 0;
          const share = (productData.amt / yearTotal) * 100;
          
          products.push({
            model: productName,
            qty: Math.round(productData.qty),
            amt: Math.round(productData.amt),
            price: Math.round(price),
            share: parseFloat(share.toFixed(2)),
          });
        });

        // Sort by amount descending and take top N
        products.sort((a, b) => b.amt - a.amt);
        topProducts[entityName][yearStr] = products.slice(0, limit);
      });
    });

    // Sort entities alphabetically
    entities.sort();

    return NextResponse.json({
      success: true,
      data: {
        entities,
        topProducts,
      },
    });
  } catch (error) {
    console.error('❌ Corp Top Products API - Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch top products data', details: (error as Error).message },
      { status: 500 }
    );
  }
}

