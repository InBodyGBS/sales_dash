// app/api/item-master/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    console.log(`📁 Processing Item Master file: ${file.name}`);

    // Parse Excel file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) {
      return NextResponse.json(
        { error: 'Excel file is empty' },
        { status: 400 }
      );
    }

    console.log(`📊 Parsed ${jsonData.length} rows from Excel`);

    // Expected columns: item_number, fg_classification, category, model, product
    // Try to detect column names (case-insensitive)
    const detectColumn = (row: any, possibleNames: string[]): string | null => {
      for (const name of possibleNames) {
        const keys = Object.keys(row);
        const found = keys.find(key => key.toLowerCase() === name.toLowerCase());
        if (found) return found;
      }
      return null;
    };

    const firstRow = jsonData[0] as any;
    const itemNumberCol = detectColumn(firstRow, ['item_number', 'item number', 'item_code', 'item code', 'item']);
    const fgCol = detectColumn(firstRow, ['fg_classification', 'fg classification', 'fg', 'fg_class']);
    const categoryCol = detectColumn(firstRow, ['category']);
    const modelCol = detectColumn(firstRow, ['model']);
    const productCol = detectColumn(firstRow, ['product', 'product_name', 'product name']);

    if (!itemNumberCol) {
      return NextResponse.json(
        { error: 'Item number column not found. Expected columns: item_number, fg_classification, category, model, product' },
        { status: 400 }
      );
    }

    // Transform data
    const mappings = jsonData.map((row: any, index: number) => {
      const itemNumber = row[itemNumberCol]?.toString().trim();
      if (!itemNumber) {
        throw new Error(`Row ${index + 2}: Item number is required`);
      }

      return {
        item_number: itemNumber,
        fg_classification: fgCol ? (row[fgCol]?.toString().trim() || null) : null,
        category: categoryCol ? (row[categoryCol]?.toString().trim() || null) : null,
        model: modelCol ? (row[modelCol]?.toString().trim() || null) : null,
        product: productCol ? (row[productCol]?.toString().trim() || null) : null,
      };
    });

    // Deactivate existing mappings for uploaded items
    const supabase = createServiceClient();
    const itemNumbers = mappings.map(m => m.item_number);
    
    // Try to deactivate existing mappings (handle gracefully if table/columns don't exist)
    if (itemNumbers.length > 0) {
      try {
        const updateData: any = { is_active: false };
        // Only add updated_at if column exists
        try {
          updateData.updated_at = new Date().toISOString();
        } catch (e) {
          // updated_at column may not exist, continue without it
        }
        
        const { error: updateError } = await supabase
          .from('item_master')
          .update(updateData)
          .in('item_number', itemNumbers);
        
        if (updateError) {
          // If table doesn't exist, log warning but continue
          if (updateError.code === '42P01' || updateError.code === 'PGRST116' || updateError.message?.includes('does not exist')) {
            console.warn('Item master table does not exist yet. Skipping deactivation step.');
          } else {
            console.warn('Error deactivating existing mappings:', updateError);
            // Continue anyway - we'll try to insert new mappings
          }
        }
      } catch (e) {
        console.warn('Error during deactivation step:', e);
        // Continue anyway
      }
    }

    // Insert new mappings
    const { data, error } = await supabase
      .from('item_master')
      .upsert(mappings, {
        onConflict: 'item_number',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error('Error inserting item master mappings:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      
      // If table doesn't exist, return helpful error
      if (error.code === '42P01' || error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Item master table does not exist. Please create the table first using the SQL script: database/create-item-master-table.sql',
            details: error.message,
          },
          { status: 500 }
        );
      }
      
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded ${mappings.length} item master mappings`,
      count: mappings.length,
      mappings: data,
    });
  } catch (error) {
    console.error('Error processing item master file:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process item master file',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

