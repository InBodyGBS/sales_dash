import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Get list of entities that have data in sales_data table
 * This is optimized to use a single RPC query instead of checking each entity individually
 */
export async function GET() {
  try {
    const supabase = createServiceClient();
    
    // Try to use RPC function first (fastest method)
    // But also use fallback to ensure we get all entities including China
    let rpcEntities: string[] = [];
    try {
      const { data, error } = await supabase
        .rpc('get_distinct_entities');
      
      if (!error && data && Array.isArray(data)) {
        // RPC function returns array of {entity: string} or just strings
        data.forEach((row: any) => {
          const entity = row?.entity || row;
          if (entity && typeof entity === 'string') {
            rpcEntities.push(entity);
          }
        });
        
        console.log(`✅ Found ${rpcEntities.length} entities with data (RPC):`, rpcEntities);
        
        // Check if we have all expected entities (at least 8: HQ, USA, BWA, Vietnam, Healthcare, Korot, Japan, China)
        // If RPC returns less than expected, use fallback to be safe
        const expectedEntities = ['HQ', 'USA', 'BWA', 'Vietnam', 'Healthcare', 'Korot', 'Japan', 'China'];
        const hasAllExpected = expectedEntities.every(e => rpcEntities.includes(e));
        
        // Always use fallback if China is missing, even if RPC returns 7 entities
        if (hasAllExpected && rpcEntities.length >= 8) {
          // RPC has all expected entities including China, use it
          console.log(`✅ RPC has all ${rpcEntities.length} expected entities including China`);
          return NextResponse.json({ entities: rpcEntities.sort() });
        } else {
          const missingEntities = expectedEntities.filter(e => !rpcEntities.includes(e));
          console.warn(`⚠️ RPC returned ${rpcEntities.length} entities but missing: ${missingEntities.join(', ')}. Using fallback to ensure completeness.`);
          // Continue to fallback to ensure we get all entities
        }
      }
      
      // If RPC function doesn't exist, fall back to regular query
      if (error && (error.code === '42883' || error.message?.includes('function') || error.message?.includes('does not exist'))) {
        console.warn('⚠️ RPC function not found, using fallback method...');
      } else if (error) {
        console.warn('⚠️ RPC error (will use fallback):', error.message);
      }
    } catch (rpcError) {
      console.warn('⚠️ RPC call failed, using fallback method...', rpcError);
    }
    
    // Fallback: Use pagination to fetch all entities (more reliable than single limit)
    // Since there are only ~8 entities, we can safely fetch enough rows to get all of them
    const PAGE_SIZE = 10000; // Increased limit to ensure we get all entities
    const entitySet = new Set<string>(rpcEntities); // Start with RPC results if any
    let page = 0;
    let hasMore = true;
    
    while (hasMore && page < 10) { // Max 10 pages to avoid infinite loops
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      const { data, error } = await supabase
        .from('mv_sales_cube')
        .select('entity')
        .not('entity', 'is', null)
        .order('entity', { ascending: true })
        .range(from, to);
      
      if (error) {
        console.error(`❌ Error fetching available entities (page ${page}):`, error);
        // If query fails, break and return what we have so far
        break;
      }
      
      if (data && Array.isArray(data) && data.length > 0) {
        data.forEach((row: any) => {
          if (row?.entity && typeof row.entity === 'string') {
            entitySet.add(row.entity);
          }
        });
        
        // If we got less than PAGE_SIZE rows, we've reached the end
        hasMore = data.length === PAGE_SIZE;
        page++;
        
        // If we already have all expected entities (8 entities), we can stop early
        if (entitySet.size >= 8) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }
    
    const entities = Array.from(entitySet).sort();
    
    const method = rpcEntities.length > 0 ? 'RPC + fallback' : 'fallback';
    console.log(`✅ Found ${entities.length} entities with data (${method}, ${page} pages):`, entities);
    
    // Log if China is missing
    if (!entities.includes('China')) {
      console.warn('⚠️ WARNING: China entity not found in database. Please check if China data exists in sales_data table.');
    }
    
    return NextResponse.json({ entities });
  } catch (error) {
    console.error('❌ Error in available entities API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch available entities', 
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
