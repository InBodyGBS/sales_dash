// app/api/item-mapping/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// GET: Retrieve item mappings for an entity
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entity = searchParams.get('entity');
    const itemNumber = searchParams.get('item_number');

    if (!entity) {
      return NextResponse.json(
        { error: 'Entity parameter is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    let query = supabase
      .from('item_mapping')
      .select('*')
      .eq('entity', entity)
      .eq('is_active', true);

    if (itemNumber) {
      query = query.eq('item_number', itemNumber);
    }

    const { data, error } = await query.order('item_number');

    if (error) {
      // If table doesn't exist, return empty array instead of error
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Item mapping table does not exist yet. Returning empty array.');
        return NextResponse.json({
          success: true,
          entity,
          mappings: [],
        });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      entity,
      mappings: data || [],
    });
  } catch (error) {
    console.error('Error fetching item mappings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch item mappings',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

// POST: Create or update item mappings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entity, mappings } = body;

    if (!entity || !mappings || !Array.isArray(mappings)) {
      return NextResponse.json(
        { error: 'Entity and mappings array are required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Deactivate existing mappings for this entity
    await supabase
      .from('item_mapping')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('entity', entity);

    // Insert new mappings
    const mappingRecords = mappings.map((mapping: any) => ({
      entity,
      item_number: mapping.item_number,
      fg_classification: mapping.fg_classification || null,
      category: mapping.category || null,
      model: mapping.model || null,
      product: mapping.product || null,
      is_active: true,
    }));

    const { data, error } = await supabase
      .from('item_mapping')
      .upsert(mappingRecords, {
        onConflict: 'entity,item_number',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully saved ${mappingRecords.length} item mappings`,
      mappings: data,
    });
  } catch (error) {
    console.error('Error saving item mappings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save item mappings',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

// DELETE: Deactivate all item mappings for an entity
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entity = searchParams.get('entity');

    if (!entity) {
      return NextResponse.json(
        { error: 'Entity parameter is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // First, get the count of active items
    const { count, error: countError } = await supabase
      .from('item_mapping')
      .select('*', { count: 'exact', head: true })
      .eq('entity', entity)
      .eq('is_active', true);

    // Delete all active items for this entity
    const { error } = await supabase
      .from('item_mapping')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('entity', entity)
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deactivated all item mappings for ${entity}`,
      count: count || 0,
    });
  } catch (error) {
    console.error('Error deleting item mappings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete item mappings',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

