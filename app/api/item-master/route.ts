// app/api/item-master/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// GET: Retrieve item master mappings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const itemNumber = searchParams.get('item_number');

    const supabase = createServiceClient();

    // Try querying with is_active filter first
    let query = supabase
      .from('item_master')
      .select('item_number, fg_classification, category, model, product, is_active')
      .eq('is_active', true);

    if (itemNumber) {
      query = query.eq('item_number', itemNumber);
    }

    query = query.order('item_number', { ascending: true });
    const { data, error } = await query;

    if (error) {
      // Log full error details for debugging
      console.error('Item master query error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      // If table doesn't exist, return empty array instead of error
      if (
        error.code === '42P01' || 
        error.code === 'PGRST116' ||
        error.message?.includes('does not exist') ||
        error.message?.includes('relation') ||
        error.message?.includes('table')
      ) {
        console.warn('Item master table does not exist yet. Returning empty array.');
        return NextResponse.json({
          success: true,
          mappings: [],
        });
      }

      // If column doesn't exist, try without is_active filter
      if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('is_active')) {
        console.warn('is_active column does not exist, retrying without filter');
        let retryQuery = supabase
          .from('item_master')
          .select('item_number, fg_classification, category, model, product');
        
        if (itemNumber) {
          retryQuery = retryQuery.eq('item_number', itemNumber);
        }
        
        retryQuery = retryQuery.order('item_number', { ascending: true });
        const { data: retryData, error: retryError } = await retryQuery;
        
        if (retryError) {
          throw retryError;
        }
        
        return NextResponse.json({
          success: true,
          mappings: retryData || [],
        });
      }

      throw error;
    }

    return NextResponse.json({
      success: true,
      mappings: data || [],
    });
  } catch (error) {
    console.error('Error fetching item master mappings:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch item master mappings',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// POST: Create or update item master mappings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mappings } = body;

    if (!mappings || !Array.isArray(mappings)) {
      return NextResponse.json(
        { error: 'Mappings array is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Deactivate existing mappings
    const itemNumbers = mappings.map((m: any) => m.item_number).filter(Boolean);
    if (itemNumbers.length > 0) {
      await supabase
        .from('item_master')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in('item_number', itemNumbers);
    }

    // Insert new mappings
    const mappingRecords = mappings.map((mapping: any) => ({
      item_number: mapping.item_number,
      fg_classification: mapping.fg_classification || null,
      category: mapping.category || null,
      model: mapping.model || null,
      product: mapping.product || null,
      is_active: true,
    }));

    const { data, error } = await supabase
      .from('item_master')
      .upsert(mappingRecords, {
        onConflict: 'item_number',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully saved ${mappingRecords.length} item master mappings`,
      mappings: data,
    });
  } catch (error) {
    console.error('Error saving item master mappings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save item master mappings',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

// DELETE: Deactivate item master mapping(s)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const itemNumber = searchParams.get('item_number');
    const deleteAll = searchParams.get('all') === 'true';

    const supabase = createServiceClient();

    if (deleteAll) {
      // Delete all item master mappings
      // First, get the count of active items
      const { count, error: countError } = await supabase
        .from('item_master')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (countError) {
        // If count fails, try to get count without is_active filter
        const { count: totalCount, error: totalCountError } = await supabase
          .from('item_master')
          .select('*', { count: 'exact', head: true });

        if (totalCountError) {
          throw countError; // Use original error
        }
        
        // If we got total count, use it (but this includes inactive items)
        // We'll still try to delete only active ones
        const { error } = await supabase
          .from('item_master')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('is_active', true);

        if (error) {
          throw error;
        }

        return NextResponse.json({
          success: true,
          message: `Successfully deactivated all active item master mappings`,
          count: count || 0,
        });
      }

      // Delete all active items
      const { error } = await supabase
        .from('item_master')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('is_active', true);

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        message: `Successfully deactivated all item master mappings (${count || 0} items)`,
        count: count || 0,
      });
    } else {
      // Delete specific item master mapping
      if (!itemNumber) {
        return NextResponse.json(
          { error: 'Item number parameter is required (or use ?all=true to delete all)' },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from('item_master')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('item_number', itemNumber);

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        message: `Successfully deactivated item master mapping for ${itemNumber}`,
      });
    }
  } catch (error) {
    console.error('Error deleting item master mapping:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete item master mapping',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

