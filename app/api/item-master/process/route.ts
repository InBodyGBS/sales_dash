// app/api/item-master/process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    console.log('📥 Item Master process request received');
    const body = await request.json();
    const { storagePath, fileName } = body;

    console.log('📋 Request body:', { storagePath, fileName });

    if (!storagePath || !fileName) {
      console.error('❌ Missing required parameters:', { storagePath: !!storagePath, fileName: !!fileName });
      return NextResponse.json(
        { 
          success: false,
          error: 'storagePath and fileName are required',
          details: `storagePath: ${storagePath ? 'provided' : 'missing'}, fileName: ${fileName ? 'provided' : 'missing'}`
        },
        { status: 400 }
      );
    }

    console.log(`📁 Processing Item Master file from storage: ${storagePath}`);

    const supabase = createServiceClient();

    // 1. Download file from Storage
    console.log('📥 Downloading file from storage...');
    const { downloadFile } = await import('@/lib/utils/storage');
    
    let fileData: Blob;
    try {
      fileData = await downloadFile(storagePath);
      console.log('✅ File downloaded successfully');
    } catch (downloadError) {
      console.error('❌ Download error:', downloadError);
      
      const errorMessage = downloadError instanceof Error ? downloadError.message : String(downloadError);
      
      // Check if bucket doesn't exist
      if (errorMessage.includes('Bucket not found') || errorMessage.includes('does not exist')) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Storage bucket not found',
            details: `Storage 버킷 'sales-files'가 존재하지 않습니다. Supabase Dashboard에서 Storage 버킷을 생성해주세요. 자세한 내용은 SUPABASE_STORAGE_SETUP.md 파일을 참고하세요.`
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to download file from storage', 
          details: errorMessage
        },
        { status: 500 }
      );
    }

    // 2. Parse Excel file
    console.log('📊 Parsing Excel file...');
    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await fileData.arrayBuffer();
    } catch (parseError) {
      console.error('❌ Failed to convert blob to array buffer:', parseError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to read file data', 
          details: parseError instanceof Error ? parseError.message : String(parseError)
        },
        { status: 500 }
      );
    }

    let workbook: XLSX.WorkBook;
    let jsonData: any[];
    try {
      workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error('Excel file has no sheets');
      }
      const worksheet = workbook.Sheets[sheetName];
      jsonData = XLSX.utils.sheet_to_json(worksheet);
    } catch (xlsxError) {
      console.error('❌ Failed to parse Excel file:', xlsxError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to parse Excel file', 
          details: xlsxError instanceof Error ? xlsxError.message : String(xlsxError)
        },
        { status: 400 }
      );
    }

    if (jsonData.length === 0) {
      return NextResponse.json(
        { error: 'Excel file is empty' },
        { status: 400 }
      );
    }

    console.log(`📊 Parsed ${jsonData.length} rows from Excel`);

    // 3. Detect column names (case-insensitive)
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

    // 4. Transform data
    console.log('🔄 Transforming data...');
    const mappings: any[] = [];
    const errors: string[] = [];
    
    for (let index = 0; index < jsonData.length; index++) {
      const row = jsonData[index];
      try {
        const itemNumber = row[itemNumberCol]?.toString().trim();
        if (!itemNumber) {
          errors.push(`Row ${index + 2}: Item number is required`);
          continue;
        }

        mappings.push({
          item_number: itemNumber,
          fg_classification: fgCol ? (row[fgCol]?.toString().trim() || null) : null,
          category: categoryCol ? (row[categoryCol]?.toString().trim() || null) : null,
          model: modelCol ? (row[modelCol]?.toString().trim() || null) : null,
          product: productCol ? (row[productCol]?.toString().trim() || null) : null,
        });
      } catch (rowError) {
        errors.push(`Row ${index + 2}: ${rowError instanceof Error ? rowError.message : String(rowError)}`);
      }
    }

    if (mappings.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'No valid mappings found', 
          details: errors.length > 0 ? errors.join('; ') : 'All rows were invalid'
        },
        { status: 400 }
      );
    }

    if (errors.length > 0) {
      console.warn(`⚠️ ${errors.length} rows had errors:`, errors.slice(0, 5));
    }

    console.log(`✅ Transformed ${mappings.length} valid mappings`);

    // 5. Deactivate existing mappings for uploaded items
    console.log('🔄 Deactivating existing mappings...');
    const itemNumbers = mappings.map(m => m.item_number);
    
    if (itemNumbers.length > 0) {
      try {
        const updateData: any = { is_active: false };
        try {
          updateData.updated_at = new Date().toISOString();
        } catch (e) {
          // updated_at column may not exist, continue without it
        }
        
        console.log(`   Attempting to deactivate ${itemNumbers.length} existing mappings...`);
        const { data: updateData_result, error: updateError } = await supabase
          .from('item_master')
          .update(updateData)
          .in('item_number', itemNumbers)
          .select();
        
        if (updateError) {
          console.warn('⚠️ Error deactivating existing mappings:', {
            code: updateError.code,
            message: updateError.message || '(empty message)',
            details: updateError.details,
            hint: updateError.hint,
            fullError: updateError,
          });
          
          if (updateError.code === '42P01' || updateError.code === 'PGRST116' || updateError.message?.includes('does not exist')) {
            console.warn('   → Item master table does not exist yet. Skipping deactivation step.');
          } else if (updateError.code === '42703' || updateError.message?.includes('column') || updateError.message?.includes('is_active')) {
            console.warn('   → is_active column does not exist. Skipping deactivation step.');
          } else {
            console.warn('   → Continuing despite deactivation error...');
          }
        } else {
          const updatedCount = updateData_result?.length || 0;
          console.log(`   ✅ Deactivated ${updatedCount} existing mappings`);
        }
      } catch (e) {
        console.warn('⚠️ Exception during deactivation step:', {
          error: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
        });
        console.warn('   → Continuing despite exception...');
      }
    } else {
      console.log('   ℹ️ No existing mappings to deactivate');
    }

    // 6. Insert new mappings
    console.log(`💾 Inserting ${mappings.length} new mappings...`);
    const { data, error } = await supabase
      .from('item_master')
      .upsert(mappings, {
        onConflict: 'item_number',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error('❌ Error inserting item master mappings:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      
      if (error.code === '42P01' || error.code === 'PGRST116' || error.code === 'PGRST205' || error.message?.includes('does not exist') || error.message?.includes('Could not find the table')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Item master table does not exist',
            details: `테이블 'item_master'가 존재하지 않습니다. Supabase SQL Editor에서 다음 스크립트를 실행해주세요:\n\n` +
                     `database/create-item-master-table.sql\n\n` +
                     `또는 직접 다음 SQL을 실행하세요:\n\n` +
                     `CREATE TABLE IF NOT EXISTS item_master (\n` +
                     `    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n` +
                     `    item_number VARCHAR(200) NOT NULL UNIQUE,\n` +
                     `    fg_classification VARCHAR(100),\n` +
                     `    category VARCHAR(200),\n` +
                     `    model VARCHAR(200),\n` +
                     `    product VARCHAR(200),\n` +
                     `    is_active BOOLEAN DEFAULT true,\n` +
                     `    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),\n` +
                     `    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()\n` +
                     `);`,
            errorCode: error.code,
            errorHint: error.hint,
          },
          { status: 500 }
        );
      }
      
      throw error;
    }
    
    console.log(`✅ Successfully inserted ${data?.length || 0} mappings`);

    // 7. Delete file from storage after successful processing
    try {
      await supabase.storage
        .from('sales-files')
        .remove([storagePath]);
      console.log(`✅ Deleted processed file from storage: ${storagePath}`);
    } catch (deleteError) {
      console.warn('Failed to delete file from storage:', deleteError);
      // Continue anyway - file deletion is not critical
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${mappings.length} item master mappings`,
      count: mappings.length,
      mappings: data,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : typeof error;
    
    console.error('❌ Error processing item master file:', {
      error: errorMessage,
      stack: errorStack,
      name: errorName,
      fullError: error,
    });
    
    // Extract more details if available
    let errorDetails = errorMessage;
    if (error instanceof Error && error.stack) {
      errorDetails = `${errorMessage}\n\nStack: ${errorStack}`;
    }
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process item master file',
        details: errorDetails,
        errorType: errorName,
      },
      { status: 500 }
    );
  }
}
