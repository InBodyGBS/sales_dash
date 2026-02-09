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
        is_active: true,
      };
    });

    // Deactivate existing mappings for uploaded items
    const supabase = createServiceClient();
    const itemNumbers = mappings.map(m => m.item_number);
    await supabase
      .from('item_master')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in('item_number', itemNumbers);

    // Insert new mappings
    const { data, error } = await supabase
      .from('item_master')
      .upsert(mappings, {
        onConflict: 'item_number',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error('Error inserting item master mappings:', error);
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

