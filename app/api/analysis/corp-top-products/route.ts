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

    // First, get all distinct entities (excluding HQ) from mv_sales_cube
    let allEntities: string[] = [];
    try {
      // Try using RPC function first (most efficient)
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_distinct_entities');
      if (!rpcError && rpcData && Array.isArray(rpcData)) {
        allEntities = rpcData
          .map((row: any) => row?.entity || row)
          .filter((entity: any) => entity && typeof entity === 'string' && entity !== 'HQ')
          .sort();
      } else {
        // Fallback: query distinct entities from mv_sales_cube
        const { data: allEntitiesData, error: entitiesError } = await supabase
          .from('mv_sales_cube')
          .select('entity')
          .neq('entity', 'HQ')
          .not('entity', 'is', null)
          .limit(10000);
        
        if (!entitiesError && allEntitiesData) {
          const allEntitiesSet = new Set<string>();
          allEntitiesData.forEach((row: any) => {
            if (row.entity) {
              allEntitiesSet.add(row.entity);
            }
          });
          allEntities = Array.from(allEntitiesSet).sort();
        }
      }
    } catch (err) {
      console.warn('⚠️ Failed to get all entities, will use entities from data:', err);
    }

    // Load exchange rates and entity currencies for KRW conversion
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

    // Use the same logic as Top 10 Products: use get_top_products RPC for each entity/year
    const topProducts: any = {};
    
    // Initialize all entities (even if they have no data)
    allEntities.forEach((entityName) => {
      topProducts[entityName] = {};
      years.forEach((y) => {
        topProducts[entityName][String(y)] = [];
      });
    });

    // Fetch top products for each entity/year combination
    for (const entityName of allEntities) {
      // If entity filter is specified, only process that entity
      if (entity && entity !== entityName) {
        continue;
      }

      for (const yearInt of years) {
        try {
          // Use the same RPC function as Top 10 Products
          const { data: rpcData, error: rpcError } = await supabase.rpc('get_top_products', {
            p_year: yearInt,
            p_entities: [entityName],
            p_limit: limit
          });

          if (!rpcError && rpcData && Array.isArray(rpcData)) {
            const yearStr = String(yearInt);
            
            // Apply KRW conversion to amounts (same logic as Group Dashboard)
            const products = rpcData.map((item: any) => {
              const qty = item.quantity || 0;
              let amt = item.amount || 0;
              
              // Apply KRW conversion (same logic as Group Dashboard)
              if (entityName && !['HQ', 'Korot', 'Healthcare'].includes(entityName)) {
                const currency = entityCurrencyMap.get(entityName);
                if (currency) {
                  const rate = exchangeRateMap.get(`${yearInt}_${currency}`) || 1;
                  amt = Math.round(amt * rate);
                }
              }
              
              const price = qty > 0 ? amt / qty : 0;
              
              // Calculate total amount for share calculation (after KRW conversion)
              const totalAmt = rpcData.reduce((sum: number, p: any) => {
                let pAmt = p.amount || 0;
                if (entityName && !['HQ', 'Korot', 'Healthcare'].includes(entityName)) {
                  const currency = entityCurrencyMap.get(entityName);
                  if (currency) {
                    const rate = exchangeRateMap.get(`${yearInt}_${currency}`) || 1;
                    pAmt = Math.round(pAmt * rate);
                  }
                }
                return sum + pAmt;
              }, 0);
              const share = totalAmt > 0 ? (amt / totalAmt) * 100 : 0;

              return {
                model: item.product || 'Unknown',
                qty: Math.round(qty),
                amt: Math.round(amt),
                price: Math.round(price),
                share: parseFloat(share.toFixed(2)),
              };
            });

            topProducts[entityName][yearStr] = products;
          }
        } catch (err) {
          console.error(`❌ Error fetching top products for ${entityName} ${yearInt}:`, err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        entities: allEntities,
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

