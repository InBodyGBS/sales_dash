import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const entity = searchParams.get('entity');
    const limit = parseInt(searchParams.get('limit') || '50');

    const supabase = await createServiceClient();

    let query = supabase
      .from('upload_history')
      .select('*')
      .order('uploaded_at', { ascending: false })
      .limit(limit);

    if (entity && entity !== 'All') {
      query = query.eq('entity', entity);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch upload history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch upload history', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ history: data || [] });
  } catch (error) {
    console.error('Upload history API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch upload history', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'History ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Get the history record first to delete the storage file
    const { data: history, error: fetchError } = await supabase
      .from('upload_history')
      .select('storage_path')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Failed to fetch history record:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch history record', details: fetchError.message },
        { status: 500 }
      );
    }

    // Delete the storage file if it exists
    if (history?.storage_path) {
      const { error: storageError } = await supabase.storage
        .from('sales-files')
        .remove([history.storage_path]);

      if (storageError) {
        console.error('Failed to delete storage file:', storageError);
        // Continue with history deletion even if storage deletion fails
      }
    }

    // Delete the history record
    const { error: deleteError } = await supabase
      .from('upload_history')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Failed to delete upload history:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete upload history', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Upload history deleted successfully' });
  } catch (error) {
    console.error('Delete upload history API error:', error);
    return NextResponse.json(
      { error: 'Failed to delete upload history', details: (error as Error).message },
      { status: 500 }
    );
  }
}