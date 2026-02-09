// app/api/column-mapping/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// GET: Retrieve column mappings for an entity
export async function GET(request: NextRequest) {
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

    const { data, error } = await supabase
      .from('column_mapping')
      .select('*')
      .eq('entity', entity)
      .eq('is_active', true)
      .order('excel_column');

    if (error) {
      // If table doesn't exist, return empty mapping instead of error
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Column mapping table does not exist yet. Returning empty mapping.');
        return NextResponse.json({
          success: true,
          entity,
          mapping: {},
          mappings: [],
        });
      }
      throw error;
    }

    // Transform to mapping object format
    const mapping: Record<string, string> = {};
    data?.forEach((row) => {
      mapping[row.excel_column] = row.db_column;
    });

    return NextResponse.json({
      success: true,
      entity,
      mapping,
      mappings: data || [],
    });
  } catch (error) {
    console.error('Error fetching column mappings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch column mappings',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

// POST: Create or update column mappings for an entity
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entity, mappings } = body;

    if (!entity || !mappings) {
      return NextResponse.json(
        { error: 'Entity and mappings are required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // First, deactivate all existing mappings for this entity
    await supabase
      .from('column_mapping')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('entity', entity);

    // Insert new mappings
    const mappingRows = Object.entries(mappings).map(([excelColumn, dbColumn]) => ({
      entity,
      excel_column: excelColumn,
      db_column: dbColumn as string,
      is_active: true,
    }));

    // Use upsert to handle duplicates
    const { data, error } = await supabase
      .from('column_mapping')
      .upsert(mappingRows, {
        onConflict: 'entity,excel_column,db_column',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      throw error;
    }

    // Update is_active for upserted rows
    await supabase
      .from('column_mapping')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('entity', entity)
      .in('excel_column', Object.keys(mappings));

    return NextResponse.json({
      success: true,
      message: 'Column mappings saved successfully',
      count: data?.length || 0,
    });
  } catch (error) {
    console.error('Error saving column mappings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save column mappings',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

// DELETE: Delete column mappings for an entity
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

    const { error } = await supabase
      .from('column_mapping')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('entity', entity);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Column mappings deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting column mappings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete column mappings',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

