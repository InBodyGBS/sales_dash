// app/api/item-master/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// GET: Retrieve item master mappings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const itemNumber = searchParams.get('item_number');

    const supabase = createServiceClient();

    let query = supabase
      .from('item_master')
      .select('*')
      .eq('is_active', true);

    if (itemNumber) {
      query = query.eq('item_number', itemNumber);
    }

    const { data, error } = await query.order('item_number');

    if (error) {
      // If table doesn't exist, return empty array instead of error
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Item master table does not exist yet. Returning empty array.');
        return NextResponse.json({
          success: true,
          mappings: [],
        });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      mappings: data || [],
    });
  } catch (error) {
    console.error('Error fetching item master mappings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch item master mappings',
        details: (error as Error).message,
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

// DELETE: Deactivate item master mapping
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const itemNumber = searchParams.get('item_number');

    if (!itemNumber) {
      return NextResponse.json(
        { error: 'Item number parameter is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

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

