import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const entity = searchParams.get('entity');
    const limit = parseInt(searchParams.get('limit') || '50');

    let supabase;
    try {
      supabase = createServiceClient();
    } catch (clientError) {
      const errorMessage = (clientError as Error).message || 'Unknown error';
      console.error('❌ Failed to create Supabase client:', {
        error: errorMessage,
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        urlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) || 'not set',
      });
      
      // If environment variables are missing, provide helpful error message
      if (errorMessage.includes('Missing') || errorMessage.includes('environment variable')) {
        return NextResponse.json(
          { 
            error: 'Database configuration missing', 
            details: errorMessage,
            hint: 'Please check your .env.local file and ensure all Supabase credentials are set'
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to initialize database connection', 
          details: errorMessage 
        },
        { status: 500 }
      );
    }

    // Check if table exists, if not return empty array
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
      // If table doesn't exist, return empty array instead of error
      const errorCode = (error as any).code;
      const errorMessage = error.message || '';
      
      if (errorCode === '42P01' || 
          errorMessage.includes('does not exist') || 
          errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
        console.warn('Upload history table does not exist yet. Returning empty history.');
        return NextResponse.json({ history: [] });
      }
      
      console.error('Failed to fetch upload history:', {
        code: errorCode,
        message: errorMessage,
        details: error
      });
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch upload history', 
          details: errorMessage,
          code: errorCode 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ history: data || [] });
  } catch (error) {
    console.error('Upload history API error:', error);
    
    // If it's a table not found error, return empty array
    const errorMessage = (error as Error).message || '';
    const errorString = JSON.stringify(error);
    
    if (errorMessage.includes('does not exist') || 
        errorMessage.includes('42P01') ||
        errorString.includes('does not exist')) {
      return NextResponse.json({ history: [] });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch upload history', 
        details: errorMessage 
      },
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

    const supabase = createServiceClient();

    // Get the history record first to delete the storage file
    const { data: history, error: fetchError } = await supabase
      .from('upload_history')
      .select('file_path, storage_path')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Failed to fetch history record:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch history record', details: fetchError.message },
        { status: 500 }
      );
    }

    // Delete the storage file if it exists (try both file_path and storage_path)
    const storagePath = (history as any)?.storage_path || history?.file_path;
    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from('sales-files')
        .remove([storagePath]);

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