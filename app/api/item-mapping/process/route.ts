// app/api/item-mapping/process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    console.log('📥 Item Mapping process request received');
    const body = await request.json();
    const { storagePath, fileName, entity } = body;

    console.log('📋 Request body:', { storagePath, fileName, entity });

    if (!storagePath || !fileName || !entity) {
      console.error('❌ Missing required parameters:', { storagePath: !!storagePath, fileName: !!fileName, entity: !!entity });
      return NextResponse.json(
        { 
          success: false,
          error: 'storagePath, fileName, and entity are required',
          details: `storagePath: ${storagePath ? 'provided' : 'missing'}, fileName: ${fileName ? 'provided' : 'missing'}, entity: ${entity ? 'provided' : 'missing'}`
        },
        { status: 400 }
      );
    }

    console.log(`📁 Processing Item Mapping file from storage: ${storagePath} for entity: ${entity}`);

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

    // 4. Transform data and check for duplicates
    console.log('🔄 Transforming data...');
    const mappings: any[] = [];
    const errors: string[] = [];
    const skippedDuplicates: string[] = []; // Track skipped duplicates within file
    const seenKeys = new Map<string, number>(); // Track (entity, item_number) combinations and their first occurrence row
    
    for (let index = 0; index < jsonData.length; index++) {
      const row = jsonData[index];
      try {
        const itemNumber = row[itemNumberCol]?.toString().trim();
        if (!itemNumber) {
          errors.push(`Row ${index + 2}: Item number is required`);
          continue;
        }

        // Check for duplicates within the same file
        const uniqueKey = `${entity}:${itemNumber}`;
        if (seenKeys.has(uniqueKey)) {
          const firstRow = seenKeys.get(uniqueKey)!;
          skippedDuplicates.push(`Row ${index + 2}: Duplicate item_number "${itemNumber}" (first occurrence at row ${firstRow})`);
          continue; // Skip duplicate, keep first occurrence
        }
        seenKeys.set(uniqueKey, index + 2); // Store row number of first occurrence

        mappings.push({
          entity,
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

    if (skippedDuplicates.length > 0) {
      console.warn(`⚠️ ${skippedDuplicates.length} duplicate rows skipped within file:`, skippedDuplicates.slice(0, 10));
    }

    if (errors.length > 0) {
      console.warn(`⚠️ ${errors.length} rows had errors:`, errors.slice(0, 5));
    }

    console.log(`✅ Transformed ${mappings.length} valid mappings${skippedDuplicates.length > 0 ? ` (${skippedDuplicates.length} duplicates skipped)` : ''}`);

    // Check 2: Check if any item_number already exists in item_master
    console.log('🔍 Checking for existing items in item_master...');
    const itemNumbersToCheck = mappings.map(m => m.item_number);
    const skippedMasterItems: string[] = [];
    let mappingsToUpload: any[] = [];
    
    try {
      const { data: existingMasterItems, error: masterCheckError } = await supabase
        .from('item_master')
        .select('item_number')
        .in('item_number', itemNumbersToCheck)
        .eq('is_active', true);

      if (masterCheckError) {
        // If table doesn't exist, skip this check
        if (masterCheckError.code === '42P01' || masterCheckError.code === 'PGRST116' || masterCheckError.code === 'PGRST205') {
          console.warn('   → Item master table does not exist. Skipping master check.');
          mappingsToUpload = mappings; // Upload all if table doesn't exist
        } else {
          console.warn('   → Error checking item_master:', masterCheckError);
          mappingsToUpload = mappings; // Upload all if check fails
        }
      } else if (existingMasterItems && existingMasterItems.length > 0) {
        const existingItemNumbers = new Set(existingMasterItems.map(item => item.item_number));
        console.warn(`   ⚠️ ${existingItemNumbers.size} items already exist in item_master, skipping them`);
        
        // Filter out items that exist in master
        for (const mapping of mappings) {
          if (existingItemNumbers.has(mapping.item_number)) {
            skippedMasterItems.push(mapping.item_number);
          } else {
            mappingsToUpload.push(mapping);
          }
        }
      } else {
        console.log(`   ✅ No conflicts with item_master (checked ${itemNumbersToCheck.length} items)`);
        mappingsToUpload = mappings; // Upload all if no conflicts
      }
    } catch (checkError) {
      console.warn('⚠️ Exception during master check:', checkError);
      mappingsToUpload = mappings; // Upload all if check fails
    }

    // Update mappings to only include items to upload
    const finalMappings = mappingsToUpload;
    
    if (skippedMasterItems.length > 0) {
      console.warn(`⚠️ Skipped ${skippedMasterItems.length} items that exist in item_master:`, skippedMasterItems.slice(0, 10));
    }

    if (finalMappings.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No items to upload',
          details: `모든 항목이 중복이거나 item_master에 이미 존재합니다.\n\n` +
                   `파일 내 중복: ${skippedDuplicates.length}개\n` +
                   `item_master에 존재: ${skippedMasterItems.length}개`,
          skippedDuplicates: skippedDuplicates.length,
          skippedMaster: skippedMasterItems.length,
        },
        { status: 400 }
      );
    }

    console.log(`📤 Ready to upload ${finalMappings.length} mappings${skippedDuplicates.length > 0 || skippedMasterItems.length > 0 ? ` (${skippedDuplicates.length} file duplicates + ${skippedMasterItems.length} master conflicts skipped)` : ''}`);

    // 5. Deactivate existing mappings for uploaded items
    console.log('🔄 Deactivating existing mappings...');
    const itemNumbersToDeactivate = finalMappings.map(m => m.item_number);
    
    if (itemNumbersToDeactivate.length > 0) {
      try {
        const updateData: any = { is_active: false };
        try {
          updateData.updated_at = new Date().toISOString();
        } catch (e) {
          // updated_at column may not exist, continue without it
        }
        
        console.log(`   Attempting to deactivate ${itemNumbersToDeactivate.length} existing mappings for entity: ${entity}...`);
        
        // Process in batches to avoid Supabase query limits (max ~1000 items per .in() query)
        const DEACTIVATE_BATCH_SIZE = 500;
        let totalDeactivated = 0;
        let hasError = false;
        
        for (let i = 0; i < itemNumbersToDeactivate.length; i += DEACTIVATE_BATCH_SIZE) {
          const batch = itemNumbersToDeactivate.slice(i, i + DEACTIVATE_BATCH_SIZE);
          
          try {
            const { data: updateData_result, error: updateError } = await supabase
              .from('item_mapping')
              .update(updateData)
              .eq('entity', entity)
              .in('item_number', batch)
              .select();
            
            if (updateError) {
              // Log detailed error information
              const errorInfo: any = {
                code: updateError.code,
                message: updateError.message,
                details: updateError.details,
                hint: updateError.hint,
              };
              
              // Try to stringify the full error object
              try {
                errorInfo.fullError = JSON.stringify(updateError, Object.getOwnPropertyNames(updateError));
              } catch (stringifyError) {
                errorInfo.fullError = String(updateError);
              }
              
              console.warn(`⚠️ Error deactivating batch ${Math.floor(i / DEACTIVATE_BATCH_SIZE) + 1} (items ${i + 1}-${Math.min(i + DEACTIVATE_BATCH_SIZE, itemNumbersToDeactivate.length)}):`, errorInfo);
              
              if (updateError.code === '42P01' || updateError.code === 'PGRST116' || updateError.code === 'PGRST205' || updateError.message?.includes('does not exist') || updateError.message?.includes('Could not find the table')) {
                console.warn('   → Item mapping table does not exist yet. Skipping deactivation step.');
                hasError = true;
                break;
              } else if (updateError.code === '42703' || updateError.message?.includes('column') || updateError.message?.includes('is_active')) {
                console.warn('   → is_active column does not exist. Skipping deactivation step.');
                hasError = true;
                break;
              } else {
                // Continue with next batch even if this one fails
                hasError = true;
              }
            } else {
              const batchCount = updateData_result?.length || 0;
              totalDeactivated += batchCount;
              console.log(`   ✅ Deactivated batch ${Math.floor(i / DEACTIVATE_BATCH_SIZE) + 1}: ${batchCount} mappings`);
            }
            
            // Small delay between batches to avoid overwhelming the database
            if (i + DEACTIVATE_BATCH_SIZE < itemNumbersToDeactivate.length) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          } catch (batchError) {
            console.warn(`⚠️ Exception during batch deactivation (batch ${Math.floor(i / DEACTIVATE_BATCH_SIZE) + 1}):`, {
              error: batchError instanceof Error ? batchError.message : String(batchError),
              stack: batchError instanceof Error ? batchError.stack : undefined,
              name: batchError instanceof Error ? batchError.name : typeof batchError,
            });
            hasError = true;
            // Continue with next batch
          }
        }
        
        if (hasError && totalDeactivated === 0) {
          console.warn('   ⚠️ Failed to deactivate any existing mappings, but continuing with upload...');
        } else if (totalDeactivated > 0) {
          console.log(`   ✅ Successfully deactivated ${totalDeactivated} existing mappings (out of ${itemNumbersToDeactivate.length} attempted)`);
        }
      } catch (e) {
        console.warn('⚠️ Exception during deactivation step:', {
          error: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
          name: e instanceof Error ? e.name : typeof e,
        });
        console.warn('   → Continuing despite exception...');
      }
    } else {
      console.log('   ℹ️ No existing mappings to deactivate');
    }

    // 6. Insert new mappings
    console.log(`💾 Inserting ${finalMappings.length} new mappings for entity: ${entity}...`);
    const { data, error } = await supabase
      .from('item_mapping')
      .upsert(finalMappings, {
        onConflict: 'entity,item_number',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error('❌ Error inserting item mappings:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      
      // Handle duplicate key error (21000)
      if (error.code === '21000' || error.message?.includes('duplicate constrained values') || error.message?.includes('cannot affect row a second time')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Duplicate item numbers found in file',
            details: `Excel 파일 내에 동일한 entity와 item_number 조합이 중복되어 있습니다.\n\n` +
                     `에러: ${error.message}\n` +
                     `힌트: ${error.hint || '파일 내 중복된 item_number를 확인하고 제거해주세요.'}\n\n` +
                     `해결 방법:\n` +
                     `1. Excel 파일에서 중복된 item_number 행을 제거\n` +
                     `2. 또는 중복된 행 중 하나만 남기고 나머지 삭제`,
            errorCode: error.code,
            errorHint: error.hint,
          },
          { status: 400 }
        );
      }
      
      if (error.code === '42P01' || error.code === 'PGRST116' || error.code === 'PGRST205' || error.message?.includes('does not exist') || error.message?.includes('Could not find the table')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Item mapping table does not exist',
            details: `테이블 'item_mapping'가 존재하지 않습니다. Supabase SQL Editor에서 다음 스크립트를 실행해주세요:\n\n` +
                     `database/create-item-mapping-table.sql\n\n` +
                     `또는 직접 다음 SQL을 실행하세요:\n\n` +
                     `CREATE TABLE IF NOT EXISTS item_mapping (\n` +
                     `    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n` +
                     `    entity VARCHAR(50) NOT NULL,\n` +
                     `    item_number VARCHAR(200) NOT NULL,\n` +
                     `    fg_classification VARCHAR(100),\n` +
                     `    category VARCHAR(200),\n` +
                     `    model VARCHAR(200),\n` +
                     `    product VARCHAR(200),\n` +
                     `    is_active BOOLEAN DEFAULT true,\n` +
                     `    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),\n` +
                     `    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),\n` +
                     `    UNIQUE(entity, item_number)\n` +
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

    // 7. Update existing sales_data with new item mappings
    console.log(`🔄 Updating existing sales_data for entity: ${entity}...`);
    let updatedSalesDataCount = 0;
    
    try {
      // Load ALL item_mapping records for this entity (including is_active = false)
      // This ensures that even if mappings were deactivated, they can still be applied to sales_data
      const { data: allMappings, error: allMappingsError } = await supabase
        .from('item_mapping')
        .select('item_number, fg_classification, category, model, product')
        .eq('entity', entity);
      
      if (allMappingsError) {
        console.warn('⚠️ Failed to load all item mappings for sales_data update:', allMappingsError);
      } else if (allMappings && allMappings.length > 0) {
        console.log(`   Found ${allMappings.length} item mappings (including inactive) to apply to sales_data...`);
        
        // Group mappings by item_number (latest mapping wins if duplicates)
        const mappingMap = new Map<string, any>();
        for (const mapping of allMappings) {
          // Use the mapping if it has at least one field with data
          if (mapping.fg_classification || mapping.category || mapping.model || mapping.product) {
            mappingMap.set(mapping.item_number, mapping);
          }
        }
        
        console.log(`   Applying ${mappingMap.size} unique item mappings to sales_data...`);
        
        // Update sales_data in batches
        const UPDATE_BATCH_SIZE = 50;
        const itemNumbers = Array.from(mappingMap.keys());
        
        for (let i = 0; i < itemNumbers.length; i += UPDATE_BATCH_SIZE) {
          const batchItemNumbers = itemNumbers.slice(i, i + UPDATE_BATCH_SIZE);
          
          // Update each item_number in the batch
          for (const itemNumber of batchItemNumbers) {
            const mapping = mappingMap.get(itemNumber);
            if (!mapping) continue;
            
            const updateData: any = {};
            if (mapping.fg_classification !== null && mapping.fg_classification !== undefined) {
              updateData.fg_classification = mapping.fg_classification;
            }
            if (mapping.category !== null && mapping.category !== undefined) {
              updateData.category = mapping.category;
            }
            if (mapping.model !== null && mapping.model !== undefined) {
              updateData.model = mapping.model;
            }
            if (mapping.product !== null && mapping.product !== undefined) {
              updateData.product = mapping.product;
            }

            // Only update if there's data to update
            if (Object.keys(updateData).length > 0) {
              const { data, error: updateError } = await supabase
                .from('sales_data')
                .update(updateData)
                .eq('entity', entity)
                .eq('item_number', itemNumber)
                .select('id');

              if (updateError) {
                console.warn(`   ⚠️ Error updating sales_data for item_number ${itemNumber}:`, updateError);
              } else {
                updatedSalesDataCount += data?.length || 0;
              }
            }
          }
          
          // Small delay between batches to avoid overwhelming the database
          if (i + UPDATE_BATCH_SIZE < itemNumbers.length) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
        
        console.log(`   ✅ Updated ${updatedSalesDataCount} sales_data records`);
      } else {
        console.log(`   ℹ️ No mappings found to apply to sales_data`);
      }
    } catch (updateError) {
      console.warn('⚠️ Exception during sales_data update:', updateError);
      // Continue anyway - sales_data update is not critical for item_mapping upload
    }

    // 8. Delete file from storage after successful processing
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
      message: `Successfully processed ${finalMappings.length} item mappings for ${entity}`,
      count: finalMappings.length,
      mappings: data,
      updatedSalesData: updatedSalesDataCount,
      skipped: {
        fileDuplicates: skippedDuplicates.length,
        masterConflicts: skippedMasterItems.length,
        fileDuplicateDetails: skippedDuplicates.slice(0, 20), // First 20 for reference
        masterConflictItems: skippedMasterItems.slice(0, 50), // First 50 for reference
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : typeof error;
    
    console.error('❌ Error processing item mapping file:', {
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
        error: 'Failed to process item mapping file',
        details: errorDetails,
        errorType: errorName,
      },
      { status: 500 }
    );
  }
}
