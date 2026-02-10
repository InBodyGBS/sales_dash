// app/api/item-mapping/update-sales-data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// POST: Manually update sales_data with item_mapping data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entity, useMaster, year } = body;

    // If useMaster is true, update all entities with item_master mappings
    // If useMaster is false, update only the specific entity with item_mapping
    const isMasterUpdate = useMaster === true;

    if (!isMasterUpdate && !entity) {
      return NextResponse.json(
        { error: 'Entity parameter is required when not using master mapping' },
        { status: 400 }
      );
    }

    const yearFilter = year ? parseInt(year.toString()) : null;
    const yearFilterText = yearFilter ? ` (year: ${yearFilter})` : '';

    console.log(`🔄 Manual sales_data update requested: ${isMasterUpdate ? 'Master (all entities)' : `Entity: ${entity}`}${yearFilterText}`);

    const supabase = createServiceClient();

    // Load item_master first (has priority), then item_mapping as fallback (if not master update)
    // This matches the logic in upload/process route
    if (isMasterUpdate) {
      console.log(`   Loading item_master mappings for all entities...`);
    } else {
      console.log(`   Loading item mappings (master first, then entity-specific)...`);
    }
    
    // Load item_master with pagination to get all records
    const PAGE_SIZE = 1000;
    let allItemMasters: any[] = [];
    let masterPage = 0;
    let hasMoreMasters = true;
    let masterPageError: any = null;
    
    while (hasMoreMasters) {
      const from = masterPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      const { data: masterPageData, error: error } = await supabase
        .from('item_master')
        .select('item_number, fg_classification, category, model, product')
        .eq('is_active', true)
        .order('item_number', { ascending: true })
        .range(from, to);
      
      if (error) {
        masterPageError = error;
        console.error('❌ Error loading item_master page:', error);
        break;
      }
      
      if (masterPageData && masterPageData.length > 0) {
        allItemMasters = allItemMasters.concat(masterPageData);
        masterPage++;
        hasMoreMasters = masterPageData.length === PAGE_SIZE;
      } else {
        hasMoreMasters = false;
      }
      
      // Safety limit to prevent infinite loops
      if (masterPage > 100) {
        console.warn('⚠️ Reached maximum page limit (100) for item_master');
        break;
      }
    }
    
    console.log(`   ✅ Loaded ${allItemMasters.length} item_master records (${masterPage} pages)`);
    
    // Load item_mapping with pagination if not master update
    let allItemMappings: any[] = [];
    let itemMappingPageError: any = null;
    
    if (!isMasterUpdate) {
      let mappingPage = 0;
      let hasMoreMappings = true;
      
      while (hasMoreMappings) {
        const from = mappingPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        const { data: mappingPageData, error: mappingPageError } = await supabase
          .from('item_mapping')
          .select('item_number, fg_classification, category, model, product, is_active')
          .eq('entity', entity)
          .order('item_number', { ascending: true })
          .range(from, to);
        
        if (mappingPageError) {
          itemMappingPageError = mappingPageError;
          console.error('❌ Error loading item_mapping page:', mappingPageError);
          break;
        }
        
        if (mappingPageData && mappingPageData.length > 0) {
          allItemMappings = allItemMappings.concat(mappingPageData);
          mappingPage++;
          hasMoreMappings = mappingPageData.length === PAGE_SIZE;
        } else {
          hasMoreMappings = false;
        }
        
        // Safety limit to prevent infinite loops
        if (mappingPage > 100) {
          console.warn('⚠️ Reached maximum page limit (100) for item_mapping');
          break;
        }
      }
      
      console.log(`   ✅ Loaded ${allItemMappings.length} item_mapping records (${mappingPage} pages)`);
    }
    
    const masterResult = { data: allItemMasters, error: masterPageError };
    const mappingResult = { data: allItemMappings, error: itemMappingPageError };

    const { data: itemMasters, error: itemMasterError } = masterResult;
    const { data: itemMappings, error: itemMappingError } = mappingResult;

    // First, load all item_master mappings (priority)
    const mappingMap = new Map<string, any>();
    let masterCount = 0;
    
    if (!itemMasterError && itemMasters && itemMasters.length > 0) {
      itemMasters.forEach((mapping: any) => {
        // Only add if at least one field has a non-empty value
        // Use explicit null/undefined checks to avoid treating empty strings as valid
        const hasData = 
          (mapping.fg_classification !== null && mapping.fg_classification !== undefined && mapping.fg_classification !== '') ||
          (mapping.category !== null && mapping.category !== undefined && mapping.category !== '') ||
          (mapping.model !== null && mapping.model !== undefined && mapping.model !== '') ||
          (mapping.product !== null && mapping.product !== undefined && mapping.product !== '');
        
        if (hasData) {
          const trimmedItemNumber = (mapping.item_number || '').trim();
          if (!trimmedItemNumber) return; // Skip empty item_numbers
          
          mappingMap.set(trimmedItemNumber, {
            fg_classification: mapping.fg_classification && mapping.fg_classification.trim() !== '' ? mapping.fg_classification.trim() : undefined,
            category: mapping.category && mapping.category.trim() !== '' ? mapping.category.trim() : undefined,
            model: mapping.model && mapping.model.trim() !== '' ? mapping.model.trim() : undefined,
            product: mapping.product && mapping.product.trim() !== '' ? mapping.product.trim() : undefined,
            source: 'item_master', // Track source for logging
          });
          masterCount++;
          
          // Debug logging for specific item
          if (trimmedItemNumber === '270S_O' || trimmedItemNumber.includes('270S_O')) {
            console.log(`   🔍 Debug: Found ${trimmedItemNumber} in item_master:`, {
              fg_classification: mapping.fg_classification,
              category: mapping.category,
              model: mapping.model,
              product: mapping.product,
            });
          }
        }
      });
      console.log(`   ✅ Loaded ${masterCount} item mappings from item_master`);
    } else if (itemMasterError && itemMasterError.code !== '42P01') {
      console.warn('   ⚠️ Failed to load item_master:', itemMasterError.message);
    }

    // Then, load item_mapping for items not found in master (fallback) - only if not master update
    let fallbackCount = 0;
    if (!isMasterUpdate && !itemMappingError && itemMappings && itemMappings.length > 0) {
      itemMappings.forEach((mapping: any) => {
        const trimmedItemNumber = (mapping.item_number || '').trim();
        if (!trimmedItemNumber) return; // Skip empty item_numbers
        
        // Debug logging for specific items (both 270S_O and 270S_0)
        if (trimmedItemNumber === '270S_O' || trimmedItemNumber === '270S_0' || 
            trimmedItemNumber.includes('270S_O') || trimmedItemNumber.includes('270S_0')) {
          console.log(`   🔍 Debug: Processing ${trimmedItemNumber} from item_mapping:`, {
            fg_classification: mapping.fg_classification,
            category: mapping.category,
            model: mapping.model,
            product: mapping.product,
            is_active: mapping.is_active,
            inMaster: mappingMap.has(trimmedItemNumber),
          });
        }
        
        // Only add if not already in map (master has priority)
        if (!mappingMap.has(trimmedItemNumber)) {
          // Only add if at least one field has a non-empty value
          const hasData = 
            (mapping.fg_classification !== null && mapping.fg_classification !== undefined && mapping.fg_classification !== '') ||
            (mapping.category !== null && mapping.category !== undefined && mapping.category !== '') ||
            (mapping.model !== null && mapping.model !== undefined && mapping.model !== '') ||
            (mapping.product !== null && mapping.product !== undefined && mapping.product !== '');
          
          if (hasData) {
            mappingMap.set(trimmedItemNumber, {
              fg_classification: mapping.fg_classification && mapping.fg_classification.trim() !== '' ? mapping.fg_classification.trim() : undefined,
              category: mapping.category && mapping.category.trim() !== '' ? mapping.category.trim() : undefined,
              model: mapping.model && mapping.model.trim() !== '' ? mapping.model.trim() : undefined,
              product: mapping.product && mapping.product.trim() !== '' ? mapping.product.trim() : undefined,
              source: 'item_mapping', // Track source for logging
            });
            fallbackCount++;
            
            // Debug logging for specific item
            if (trimmedItemNumber === '270S_O' || trimmedItemNumber === '270S_0' || 
                trimmedItemNumber.includes('270S_O') || trimmedItemNumber.includes('270S_0')) {
              console.log(`   🔍 Debug: Added ${trimmedItemNumber} to mappingMap from item_mapping (entity: ${entity})`);
            }
          }
        } else {
          // Debug logging for specific item - already in master
          if (trimmedItemNumber === '270S_O' || trimmedItemNumber === '270S_0' || 
              trimmedItemNumber.includes('270S_O') || trimmedItemNumber.includes('270S_0')) {
            const masterMapping = mappingMap.get(trimmedItemNumber);
            console.log(`   🔍 Debug: ${trimmedItemNumber} already in master, skipping item_mapping. Master value:`, masterMapping);
          }
        }
      });
      if (fallbackCount > 0) {
        console.log(`   ✅ Loaded ${fallbackCount} additional item mappings from item_mapping (entity: ${entity})`);
      }
    } else if (itemMappingError && itemMappingError.code !== '42P01') {
      console.warn('   ⚠️ Failed to load item_mapping:', itemMappingError.message);
    }

    if (mappingMap.size === 0) {
      return NextResponse.json({
        success: true,
        message: isMasterUpdate 
          ? `No item_master mappings found` 
          : `No item mappings found for entity: ${entity}`,
        updatedCount: 0,
        masterCount: 0,
        mappingCount: 0,
      });
    }

    console.log(`   📊 Total ${mappingMap.size} item mappings to apply (${masterCount} from master, ${fallbackCount} from entity mapping)`);

    // Group mappings by source and update type for batch processing
    const itemNumbers = Array.from(mappingMap.keys());
    const masterItemNumbers: string[] = [];
    const mappingItemNumbers: string[] = [];
    
    // Debug: Check if 270S_0 is in mappingMap
    const debugItem = itemNumbers.find(item => item === '270S_0' || item === '270S_O' || item.includes('270S_0') || item.includes('270S_O'));
    if (debugItem) {
      const debugMapping = mappingMap.get(debugItem);
      console.log(`   🔍 Debug: Found ${debugItem} in mappingMap:`, debugMapping);
    } else {
      console.log(`   🔍 Debug: 270S_0 or 270S_O NOT found in mappingMap. Total items: ${itemNumbers.length}`);
      // Check if it exists with different casing/spacing
      const similarItems = itemNumbers.filter(item => 
        item.toLowerCase().includes('270s') || 
        item.replace(/[_\s]/g, '').toLowerCase().includes('270s')
      );
      if (similarItems.length > 0) {
        console.log(`   🔍 Debug: Found similar items:`, similarItems.slice(0, 10));
      }
    }
    
    itemNumbers.forEach(itemNumber => {
      const mapping = mappingMap.get(itemNumber);
      if (!mapping) return;
      
      if (isMasterUpdate || mapping.source === 'item_master') {
        masterItemNumbers.push(itemNumber);
      } else {
        mappingItemNumbers.push(itemNumber);
      }
    });
    
    console.log(`   📦 Processing ${masterItemNumbers.length} master items and ${mappingItemNumbers.length} entity-specific items`);
    
    let updatedSalesDataCount = 0;
    const errors: string[] = [];
    const UPDATE_BATCH_SIZE = 500; // Increased batch size for better performance
    const PARALLEL_CHUNK_SIZE = 50; // Process 50 items in parallel at a time (increased from 20)
    
    // Process master items (all entities) in batches
    if (masterItemNumbers.length > 0) {
      console.log(`   🔄 Updating master items (all entities)...`);
      for (let i = 0; i < masterItemNumbers.length; i += UPDATE_BATCH_SIZE) {
        const batch = masterItemNumbers.slice(i, i + UPDATE_BATCH_SIZE);
        
        // Build update data for this batch
        const batchUpdates = batch.map(itemNumber => {
          const trimmedItemNumber = (itemNumber || '').trim();
          const mapping = mappingMap.get(trimmedItemNumber);
          
          // Debug logging for specific items (both 270S_O and 270S_0)
          const isDebugItem = trimmedItemNumber === '270S_O' || trimmedItemNumber === '270S_0' || 
                              trimmedItemNumber.includes('270S_O') || trimmedItemNumber.includes('270S_0');
          
          if (isDebugItem) {
            console.log(`   🔍 Debug: Processing ${trimmedItemNumber}, mapping found:`, !!mapping);
            if (mapping) {
              console.log(`   🔍 Debug: Mapping data for ${trimmedItemNumber}:`, mapping);
            }
          }
          
          if (!mapping) {
            if (isDebugItem) {
              console.log(`   🔍 Debug: ${trimmedItemNumber} - No mapping found in mappingMap`);
            }
            return null;
          }
          
          const updateData: any = {};
          if (mapping.fg_classification !== null && mapping.fg_classification !== undefined && mapping.fg_classification !== '') {
            updateData.fg_classification = mapping.fg_classification.trim();
          }
          if (mapping.category !== null && mapping.category !== undefined && mapping.category !== '') {
            updateData.category = mapping.category.trim();
          }
          if (mapping.model !== null && mapping.model !== undefined && mapping.model !== '') {
            updateData.model = mapping.model.trim();
          }
          if (mapping.product !== null && mapping.product !== undefined && mapping.product !== '') {
            updateData.product = mapping.product.trim();
          }
          
          if (isDebugItem) {
            console.log(`   🔍 Debug: Update data for ${trimmedItemNumber}:`, updateData);
            console.log(`   🔍 Debug: Update data keys:`, Object.keys(updateData));
          }
          
          return Object.keys(updateData).length > 0 ? { itemNumber: trimmedItemNumber, updateData } : null;
        }).filter(Boolean) as Array<{ itemNumber: string; updateData: any }>;
        
        // Process updates in parallel chunks to improve performance
        let batchCount = 0;
        
        for (let j = 0; j < batchUpdates.length; j += PARALLEL_CHUNK_SIZE) {
          const chunk = batchUpdates.slice(j, j + PARALLEL_CHUNK_SIZE);
          
          const updatePromises = chunk.map(async ({ itemNumber, updateData }) => {
            try {
              // Debug logging for specific items (both 270S_O and 270S_0)
              const isDebugItem = itemNumber === '270S_O' || itemNumber === '270S_0' || 
                                  itemNumber.includes('270S_O') || itemNumber.includes('270S_0');
              
              if (isDebugItem) {
                console.log(`   🔍 Debug ${itemNumber}: Starting update process with data:`, updateData);
              }
              
              // Build query with filters
              let checkQuery = supabase
                .from('sales_data')
                .select('id', { count: 'exact', head: true })
                .eq('item_number', itemNumber);
              
              let updateQuery = supabase
                .from('sales_data')
                .update(updateData)
                .eq('item_number', itemNumber);
              
              // Add entity filter if not master update
              if (!isMasterUpdate && entity) {
                checkQuery = checkQuery.eq('entity', entity);
                updateQuery = updateQuery.eq('entity', entity);
              }
              
              // Add year filter if specified
              if (yearFilter) {
                checkQuery = checkQuery.eq('year', yearFilter);
                updateQuery = updateQuery.eq('year', yearFilter);
              }
              
              // First, check if there are records to update
              const { count: checkCount, error: checkError } = await checkQuery;
              
              if (checkError || !checkCount || checkCount === 0) {
                if (isDebugItem) {
                  console.log(`   🔍 Debug ${itemNumber}: No records found in sales_data (checkCount: ${checkCount}, error: ${checkError?.message || 'none'})`);
                }
                return 0; // No records to update
              }
              
              if (isDebugItem) {
                console.log(`   🔍 Debug ${itemNumber}: Found ${checkCount} records to update`);
              }
              
              // Perform the update
              const { data: updateResult, error: updateError } = await updateQuery.select('id');
              
              if (updateError) {
                // Don't log HTML error pages, just the error message
                const errorMsg = updateError.message || String(updateError).substring(0, 200);
                if (!errorMsg.includes('<!DOCTYPE') && !errorMsg.includes('timeout')) {
                  errors.push(`item_number ${itemNumber}: ${errorMsg}`);
                }
                if (isDebugItem) {
                  console.log(`   🔍 Debug ${itemNumber}: Update error - ${errorMsg}`);
                }
                return 0;
              }
              
              if (isDebugItem) {
                console.log(`   🔍 Debug ${itemNumber}: ✅ Successfully updated ${updateResult?.length || 0} records with data:`, updateData);
              }
              
              // Return the number of updated records
              return updateResult?.length || 0;
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : String(err).substring(0, 200);
              if (!errorMsg.includes('<!DOCTYPE') && !errorMsg.includes('timeout')) {
                errors.push(`item_number ${itemNumber}: ${errorMsg}`);
              }
              // Log for debugging specific items
              if (itemNumber === '270S_O' || itemNumber === '270S_0' || 
                  itemNumber.includes('270S_O') || itemNumber.includes('270S_0')) {
                console.log(`   🔍 Debug ${itemNumber}: Exception - ${errorMsg}`);
              }
              return 0;
            }
          });
          
          const results = await Promise.allSettled(updatePromises);
          const chunkCount = results.reduce((sum, result) => {
            if (result.status === 'fulfilled') {
              return sum + result.value;
            }
            return sum;
          }, 0);
          
          batchCount += chunkCount;
          
          // Small delay between chunks to avoid overwhelming the database
          if (j + PARALLEL_CHUNK_SIZE < batchUpdates.length) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
        
        updatedSalesDataCount += batchCount;
        
        // Log progress
        if ((i / UPDATE_BATCH_SIZE) % 5 === 0 || i + UPDATE_BATCH_SIZE >= masterItemNumbers.length) {
          console.log(`   Progress: ${Math.min(i + UPDATE_BATCH_SIZE, masterItemNumbers.length)}/${masterItemNumbers.length} master items processed (${updatedSalesDataCount} records updated so far)`);
        }
        
        // Small delay between batches
        if (i + UPDATE_BATCH_SIZE < masterItemNumbers.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
    
    // Process entity-specific items in batches
    if (mappingItemNumbers.length > 0) {
      console.log(`   🔄 Updating entity-specific items (${entity})...`);
      for (let i = 0; i < mappingItemNumbers.length; i += UPDATE_BATCH_SIZE) {
        const batch = mappingItemNumbers.slice(i, i + UPDATE_BATCH_SIZE);
        
        // Build update data for this batch
        const batchUpdates = batch.map(itemNumber => {
          const trimmedItemNumber = (itemNumber || '').trim();
          const mapping = mappingMap.get(trimmedItemNumber);
          
          // Debug logging for specific item
          if (trimmedItemNumber === '270S_O' || trimmedItemNumber.includes('270S_O')) {
            console.log(`   🔍 Debug: Processing ${trimmedItemNumber} (entity: ${entity}), mapping found:`, !!mapping);
            if (mapping) {
              console.log(`   🔍 Debug: Mapping data for ${trimmedItemNumber}:`, mapping);
            }
          }
          
          if (!mapping) return null;
          
          const updateData: any = {};
          if (mapping.fg_classification !== null && mapping.fg_classification !== undefined && mapping.fg_classification !== '') {
            updateData.fg_classification = mapping.fg_classification.trim();
          }
          if (mapping.category !== null && mapping.category !== undefined && mapping.category !== '') {
            updateData.category = mapping.category.trim();
          }
          if (mapping.model !== null && mapping.model !== undefined && mapping.model !== '') {
            updateData.model = mapping.model.trim();
          }
          if (mapping.product !== null && mapping.product !== undefined && mapping.product !== '') {
            updateData.product = mapping.product.trim();
          }
          
          // Debug logging for specific item
          if (trimmedItemNumber === '270S_O' || trimmedItemNumber.includes('270S_O')) {
            console.log(`   🔍 Debug: Update data for ${trimmedItemNumber} (entity: ${entity}):`, updateData);
          }
          
          return Object.keys(updateData).length > 0 ? { itemNumber: trimmedItemNumber, updateData } : null;
        }).filter(Boolean) as Array<{ itemNumber: string; updateData: any }>;
        
        // Process updates in parallel chunks to improve performance
        let batchCount = 0;
        
        for (let j = 0; j < batchUpdates.length; j += PARALLEL_CHUNK_SIZE) {
          const chunk = batchUpdates.slice(j, j + PARALLEL_CHUNK_SIZE);
          
          const updatePromises = chunk.map(async ({ itemNumber, updateData }) => {
            try {
              // First, check if there are records to update
              const { count: checkCount, error: checkError } = await supabase
                .from('sales_data')
                .select('id', { count: 'exact' })
                .eq('entity', entity)
                .eq('item_number', itemNumber);
              
              if (checkError || !checkCount || checkCount === 0) {
                // Log for debugging specific items
                if (itemNumber === '270S_O' || itemNumber.includes('270S_O')) {
                  console.log(`   🔍 Debug ${itemNumber}: No records found in sales_data for entity ${entity} (checkCount: ${checkCount})`);
                }
                return 0; // No records to update
              }
              
              // Perform the update
              const { data: updateResult, error: updateError } = await supabase
                .from('sales_data')
                .update(updateData)
                .eq('entity', entity)
                .eq('item_number', itemNumber)
                .select('id');
              
              if (updateError) {
                const errorMsg = updateError.message || String(updateError).substring(0, 200);
                if (!errorMsg.includes('<!DOCTYPE') && !errorMsg.includes('timeout')) {
                  errors.push(`item_number ${itemNumber}: ${errorMsg}`);
                }
                // Log for debugging specific items
                if (itemNumber === '270S_O' || itemNumber.includes('270S_O')) {
                  console.log(`   🔍 Debug ${itemNumber}: Update error - ${errorMsg}`);
                }
                return 0;
              }
              
              // Log for debugging specific items
              if (itemNumber === '270S_O' || itemNumber.includes('270S_O')) {
                console.log(`   🔍 Debug ${itemNumber}: Updated ${updateResult?.length || 0} records for entity ${entity} with data:`, updateData);
              }
              
              // Return the number of updated records
              return updateResult?.length || 0;
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : String(err).substring(0, 200);
              if (!errorMsg.includes('<!DOCTYPE') && !errorMsg.includes('timeout')) {
                errors.push(`item_number ${itemNumber}: ${errorMsg}`);
              }
              // Log for debugging specific items
              if (itemNumber === '270S_O' || itemNumber.includes('270S_O')) {
                console.log(`   🔍 Debug ${itemNumber}: Exception - ${errorMsg}`);
              }
              return 0;
            }
          });
          
          const results = await Promise.allSettled(updatePromises);
          const chunkCount = results.reduce((sum, result) => {
            if (result.status === 'fulfilled') {
              return sum + result.value;
            }
            return sum;
          }, 0);
          
          batchCount += chunkCount;
          
          // Small delay between chunks to avoid overwhelming the database
          if (j + PARALLEL_CHUNK_SIZE < batchUpdates.length) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
        
        updatedSalesDataCount += batchCount;
        
        // Log progress
        if ((i / UPDATE_BATCH_SIZE) % 5 === 0 || i + UPDATE_BATCH_SIZE >= mappingItemNumbers.length) {
          console.log(`   Progress: ${Math.min(i + UPDATE_BATCH_SIZE, mappingItemNumbers.length)}/${mappingItemNumbers.length} entity items processed (${updatedSalesDataCount} records updated so far)`);
        }
        
        // Small delay between batches
        if (i + UPDATE_BATCH_SIZE < mappingItemNumbers.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

    console.log(`✅ Updated ${updatedSalesDataCount} sales_data records for entity: ${entity}`);

    return NextResponse.json({
      success: true,
      message: isMasterUpdate
        ? `Successfully updated ${updatedSalesDataCount} sales_data records across all entities`
        : `Successfully updated ${updatedSalesDataCount} sales_data records for ${entity}`,
      updatedCount: updatedSalesDataCount,
      totalMappings: mappingMap.size,
      masterCount: masterCount,
      mappingCount: fallbackCount,
      isMasterUpdate: isMasterUpdate,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Return first 10 errors if any
    });
  } catch (error) {
    console.error('❌ Error updating sales_data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update sales_data',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
