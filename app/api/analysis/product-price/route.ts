import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const model = searchParams.get('model');
    const year = searchParams.get('year') || '2024,2025';

    const supabase = createServiceClient();
    const years = year.split(',').map(y => parseInt(y.trim())).filter(y => !isNaN(y));

    // Use mv_sales_cube (same data source as corp-top-products) instead of sales_data
    // PRD: Channel Inter-Company 제외, fg_classification = 'FG' 필터
    let query = supabase
      .from('mv_sales_cube')
      .select('entity, year, product, category, total_quantity, total_amount, fg_classification, channel')
      .neq('entity', 'HQ')
      .not('product', 'is', null)
      .eq('fg_classification', 'FG')
      .or('channel.is.null,channel.neq.Inter-Company') // Inter-Company 제외
      .in('year', years.length > 0 ? years : [2024, 2025]);

    if (model) {
      query = query.eq('product', model);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Product Price API - Query error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch product price data', details: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          categories: [],
          models: [],
          productCategories: {},
          priceData: {},
        },
      });
    }

    // Debug: Log entity distribution
    const entityCounts = new Map<string, number>();
    const entityProductMap = new Map<string, Set<string>>();
    data.forEach((row: any) => {
      const entity = row.entity || 'unknown';
      const product = row.product || '';
      entityCounts.set(entity, (entityCounts.get(entity) || 0) + 1);
      if (!entityProductMap.has(entity)) {
        entityProductMap.set(entity, new Set());
      }
      if (product) {
        entityProductMap.get(entity)!.add(product);
      }
    });
    console.log('📊 Product Price API - Entity distribution:', Object.fromEntries(entityCounts));
    if (model) {
      console.log(`📊 Product Price API - Filtered by product: ${model}`);
      console.log('📊 Product Price API - Entities with this product:', Array.from(entityProductMap.entries())
        .filter(([entity, products]) => products.has(model))
        .map(([entity]) => entity));
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

    // Aggregate data by product, year, entity with KRW conversion
    const modelMap = new Map<string, Map<string, Map<string, { qty: number; amt: number }>>>();
    const modelTotalAmt = new Map<string, number>();
    const productCategoryMap = new Map<string, string>(); // product -> category mapping
    const categorySet = new Set<string>();

    data.forEach((row) => {
      const productName = row.product || '';
      const category = row.category || '';
      const yearStr = String(row.year);
      const entity = row.entity || '';
      const qty = parseFloat(row.total_quantity) || 0; // mv_sales_cube uses total_quantity
      let amt = parseFloat(row.total_amount) || 0; // mv_sales_cube uses total_amount

      // Track category for each product
      if (category && productName) {
        productCategoryMap.set(productName, category);
        categorySet.add(category);
      }

      // Apply KRW conversion (same logic as Group Dashboard)
      if (entity && !['HQ', 'Korot', 'Healthcare'].includes(entity)) {
        const currency = entityCurrencyMap.get(entity);
        if (currency) {
          const rate = exchangeRateMap.get(`${row.year}_${currency}`) || 1;
          amt = Math.round(amt * rate);
        }
      }

      if (!modelMap.has(productName)) {
        modelMap.set(productName, new Map());
        modelTotalAmt.set(productName, 0);
      }

      const yearMap = modelMap.get(productName)!;
      if (!yearMap.has(yearStr)) {
        yearMap.set(yearStr, new Map());
      }

      const entityMap = yearMap.get(yearStr)!;
      if (!entityMap.has(entity)) {
        entityMap.set(entity, { qty: 0, amt: 0 });
      }

      const entityData = entityMap.get(entity)!;
      entityData.qty += qty;
      entityData.amt += amt;
      modelTotalAmt.set(productName, (modelTotalAmt.get(productName) || 0) + amt);
    });

    // Convert to response format
    const priceData: any = {};
    const models: string[] = [];
    const categories = Array.from(categorySet).sort();

    modelMap.forEach((yearMap, modelName) => {
      priceData[modelName] = {};
      yearMap.forEach((entityMap, yearStr) => {
        priceData[modelName][yearStr] = {};
        const entitiesInYear: string[] = [];
        entityMap.forEach((entityData, entity) => {
          const price = entityData.qty > 0 ? entityData.amt / entityData.qty : 0;
          priceData[modelName][yearStr][entity] = {
            qty: Math.round(entityData.qty),
            amt: Math.round(entityData.amt),
            price: Math.round(price),
          };
          entitiesInYear.push(entity);
        });
        // Debug: Log entities for this product/year
        if (model && model === modelName) {
          console.log(`📊 Product Price API - ${modelName} (${yearStr}): entities =`, entitiesInYear.sort());
        }
      });
      models.push(modelName);
    });

    // Sort models by total amount (descending)
    models.sort((a, b) => (modelTotalAmt.get(b) || 0) - (modelTotalAmt.get(a) || 0));

    // Build product-category mapping
    const productCategories: { [product: string]: string } = {};
    productCategoryMap.forEach((category, product) => {
      productCategories[product] = category;
    });

    return NextResponse.json({
      success: true,
      data: {
        categories,
        models,
        productCategories,
        priceData,
      },
    });
  } catch (error) {
    console.error('❌ Product Price API - Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product price data', details: (error as Error).message },
      { status: 500 }
    );
  }
}

