/**
 * Japan Entity Item Mapping 업데이트 스크립트 (Node.js)
 * 
 * 사용법:
 * 1. 환경 변수 설정: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * 2. npm install @supabase/supabase-js
 * 3. node scripts/update-japan-sales-data.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// 배치 크기
const BATCH_SIZE = 1000;
const DELAY_MS = 100; // 배치 간 딜레이

/**
 * 딜레이 함수
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * item_master에서 매핑 가져오기
 */
async function getItemMasterMappings() {
  console.log('📥 Loading item_master mappings...');
  
  const { data, error } = await supabase
    .from('item_master')
    .select('item_number, fg_classification, category, model, product')
    .eq('is_active', true);
  
  if (error) {
    console.error('❌ Error loading item_master:', error);
    throw error;
  }
  
  const mapping = new Map();
  data.forEach(item => {
    if (item.item_number) {
      mapping.set(item.item_number.trim(), {
        fg_classification: item.fg_classification?.trim() || null,
        category: item.category?.trim() || null,
        model: item.model?.trim() || null,
        product: item.product?.trim() || null,
        source: 'item_master'
      });
    }
  });
  
  console.log(`✅ Loaded ${mapping.size} item_master mappings`);
  return mapping;
}

/**
 * item_mapping에서 매핑 가져오기 (Japan만)
 */
async function getItemMappingMappings(masterMappings) {
  console.log('📥 Loading item_mapping mappings for Japan...');
  
  const { data, error } = await supabase
    .from('item_mapping')
    .select('item_number, fg_classification, category, model, product')
    .eq('entity', 'Japan')
    .eq('is_active', true);
  
  if (error) {
    console.error('❌ Error loading item_mapping:', error);
    throw error;
  }
  
  const mapping = new Map();
  data.forEach(item => {
    if (item.item_number) {
      const key = item.item_number.trim();
      // item_master에 없는 경우만 추가
      if (!masterMappings.has(key)) {
        mapping.set(key, {
          fg_classification: item.fg_classification?.trim() || null,
          category: item.category?.trim() || null,
          model: item.model?.trim() || null,
          product: item.product?.trim() || null,
          source: 'item_mapping'
        });
      }
    }
  });
  
  console.log(`✅ Loaded ${mapping.size} item_mapping mappings (not in master)`);
  return mapping;
}

/**
 * Japan sales_data 레코드 가져오기 (페이지네이션)
 */
async function getJapanSalesData(page = 0, pageSize = 1000) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  
  const { data, error, count } = await supabase
    .from('sales_data')
    .select('id, item_number, fg_classification, category, model, product', { count: 'exact' })
    .eq('entity', 'Japan')
    .not('item_number', 'is', null)
    .range(from, to);
  
  if (error) {
    console.error('❌ Error loading sales_data:', error);
    throw error;
  }
  
  return { data: data || [], hasMore: (count || 0) > to + 1, total: count || 0 };
}

/**
 * 배치 업데이트
 */
async function updateBatch(updates) {
  if (updates.length === 0) return 0;
  
  const { data, error } = await supabase
    .from('sales_data')
    .upsert(updates, { onConflict: 'id' });
  
  if (error) {
    console.error('❌ Batch update error:', error);
    throw error;
  }
  
  return updates.length;
}

/**
 * 메인 업데이트 함수
 */
async function updateJapanSalesData() {
  try {
    console.log('🚀 Starting Japan sales_data update...\n');
    
    // 1. 매핑 데이터 로드
    const masterMappings = await getItemMasterMappings();
    const mappingMappings = await getItemMappingMappings(masterMappings);
    const allMappings = new Map([...masterMappings, ...mappingMappings]);
    
    if (allMappings.size === 0) {
      console.log('⚠️ No mappings found. Exiting.');
      return;
    }
    
    // 2. sales_data 가져오기 및 업데이트
    let page = 0;
    let totalUpdated = 0;
    let totalProcessed = 0;
    
    while (true) {
      const { data: records, hasMore, total } = await getJapanSalesData(page);
      
      if (records.length === 0) break;
      
      console.log(`\n📄 Processing page ${page + 1} (${records.length} records, total: ${total})`);
      
      // 업데이트할 레코드 준비
      const updates = [];
      let batchUpdated = 0;
      
      for (const record of records) {
        const itemNumber = record.item_number?.trim();
        if (!itemNumber) continue;
        
        const mapping = allMappings.get(itemNumber);
        if (!mapping) continue;
        
        const updateData = {
          id: record.id,
          fg_classification: mapping.fg_classification || record.fg_classification,
          category: mapping.category || record.category,
          model: mapping.model || record.model,
          product: mapping.product || record.product
        };
        
        // 변경사항이 있는지 확인
        const hasChanges = 
          updateData.fg_classification !== record.fg_classification ||
          updateData.category !== record.category ||
          updateData.model !== record.model ||
          updateData.product !== record.product;
        
        if (hasChanges) {
          updates.push(updateData);
          batchUpdated++;
        }
      }
      
      // 배치 업데이트
      if (updates.length > 0) {
        for (let i = 0; i < updates.length; i += BATCH_SIZE) {
          const batch = updates.slice(i, i + BATCH_SIZE);
          await updateBatch(batch);
          totalUpdated += batch.length;
          
          if (i + BATCH_SIZE < updates.length) {
            await delay(DELAY_MS);
          }
        }
        console.log(`   ✅ Updated ${batchUpdated} records`);
      } else {
        console.log(`   ⏭️  No updates needed for this page`);
      }
      
      totalProcessed += records.length;
      
      if (!hasMore) break;
      page++;
      
      await delay(DELAY_MS);
    }
    
    console.log(`\n✅ Update completed!`);
    console.log(`   Total processed: ${totalProcessed} records`);
    console.log(`   Total updated: ${totalUpdated} records`);
    
  } catch (error) {
    console.error('\n❌ Update failed:', error);
    process.exit(1);
  }
}

// 실행
if (require.main === module) {
  updateJapanSalesData()
    .then(() => {
      console.log('\n🎉 Done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { updateJapanSalesData };
