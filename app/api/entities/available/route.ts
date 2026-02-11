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
    try {
      const { data, error } = await supabase
        .rpc('get_distinct_entities');
      
      if (!error && data && Array.isArray(data)) {
        // RPC function returns array of {entity: string} or just strings
        const entities: string[] = [];
        data.forEach((row: any) => {
          const entity = row?.entity || row;
          if (entity && typeof entity === 'string') {
            entities.push(entity);
          }
        });
        
        console.log(`✅ Found ${entities.length} entities with data (RPC):`, entities);
        return NextResponse.json({ entities: entities.sort() });
      }
      
      // If RPC function doesn't exist, fall back to regular query
      if (error && (error.code === '42883' || error.message?.includes('function') || error.message?.includes('does not exist'))) {
        console.warn('⚠️ RPC function not found, using fallback method...');
      } else if (error) {
        console.error('❌ RPC error:', error);
        throw error;
      }
    } catch (rpcError) {
      console.warn('⚠️ RPC call failed, using fallback method...', rpcError);
    }
    
    // Fallback: Use a simple query with limit (should be enough for distinct entities)
    const { data, error } = await supabase
      .from('sales_data')
      .select('entity')
      .not('entity', 'is', null)
      .limit(1000); // Limit to avoid timeout, but should be enough to get all entities
    
    if (error) {
      console.error('❌ Error fetching available entities:', error);
      // If query fails, return empty array
      return NextResponse.json({ entities: [] });
    }
    
    // Extract unique entities from the data
    const entitySet = new Set<string>();
    if (data && Array.isArray(data)) {
      data.forEach((row: any) => {
        if (row?.entity && typeof row.entity === 'string') {
          entitySet.add(row.entity);
        }
      });
    }
    
    const entities = Array.from(entitySet).sort();
    
    console.log(`✅ Found ${entities.length} entities with data (fallback):`, entities);
    
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
