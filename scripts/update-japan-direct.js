/**
 * Japan Entity 직접 업데이트 스크립트
 * Service Role Key를 사용하여 RLS 우회
 * 
 * 사용법:
 * 1. .env 파일에 SUPABASE_SERVICE_ROLE_KEY 설정
 * 2. node scripts/update-japan-direct.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  console.error('   Service Role Key is required to bypass RLS');
  process.exit(1);
}

// Service Role Key로 클라이언트 생성 (RLS 우회)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const BATCH_SIZE = 500;
const DELAY_MS = 50;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function updateJapanSalesData() {
  try {
    console.log('🚀 Starting Japan sales_data update with Service Role Key...\n');
    
    // 1. item_master 매핑 로드
    console.log('📥 Loading item_master mappings...');
    const { data: masterData, error: masterError } = await supabase
      .from('item_master')
      .select('item_number, fg_classification, category, model, product')
      .eq('is_active', true);
    
    if (masterError) throw masterError;
    
    const masterMap = new Map();
    masterData.forEach(item => {
      if (item.item_number) {
        masterMap.set(item.item_number.trim(), {
          fg_classification: item.fg_classification?.trim() || null,
          category: item.category?.trim() || null,
          model: item.model?.trim() || null,
          product: item.product?.trim() || null,
        });
      }
    });
    console.log(`✅ Loaded ${masterMap.size} item_master mappings\n`);
    
    // 2. item_mapping 매핑 로드 (Japan만, master에 없는 것만)
    console.log('📥 Loading item_mapping mappings for Japan...');
    const { data: mappingData, error: mappingError } = await supabase
      .from('item_mapping')
      .select('item_number, fg_classification, category, model, product')
      .eq('entity', 'Japan')
      .eq('is_active', true);
    
    if (mappingError) throw mappingError;
    
    const mappingMap = new Map();
    mappingData.forEach(item => {
      if (item.item_number) {
        const key = item.item_number.trim();
        if (!masterMap.has(key)) {
          mappingMap.set(key, {
            fg_classification: item.fg_classification?.trim() || null,
            category: item.category?.trim() || null,
            model: item.model?.trim() || null,
            product: item.product?.trim() || null,
          });
        }
      }
    });
    console.log(`✅ Loaded ${mappingMap.size} item_mapping mappings (not in master)\n`);
    
    const allMappings = new Map([...masterMap, ...mappingMap]);
    
    // 3. Japan sales_data 가져오기 (페이지네이션)
    let page = 0;
    let totalUpdated = 0;
    let totalProcessed = 0;
    
    while (true) {
      const from = page * 1000;
      const to = from + 999;
      
      const { data: records, error: fetchError, count } = await supabase
        .from('sales_data')
        .select('id, item_number, fg_classification, category, model, product', { count: 'exact' })
        .eq('entity', 'Japan')
        .not('item_number', 'is', null)
        .range(from, to);
      
      if (fetchError) throw fetchError;
      
      if (!records || records.length === 0) break;
      
      console.log(`📄 Processing page ${page + 1} (${records.length} records, total: ${count})`);
      
      // 업데이트할 레코드 준비
      const updates = [];
      
      for (const record of records) {
        const itemNumber = record.item_number?.trim();
        if (!itemNumber) continue;
        
        // 디버깅: 270S_O 관련
        if (itemNumber === '270S_O' || itemNumber === '270S_0') {
          console.log(`   🔍 Debug ${itemNumber}: checking mapping...`);
        }
        
        const mapping = allMappings.get(itemNumber);
        if (!mapping) {
          if (itemNumber === '270S_O' || itemNumber === '270S_0') {
            console.log(`   ❌ ${itemNumber}: No mapping found in allMappings`);
          }
          continue;
        }
        
        if (itemNumber === '270S_O' || itemNumber === '270S_0') {
          console.log(`   ✅ ${itemNumber}: Found mapping:`, mapping);
        }
        
        const updateData = {
          id: record.id,
        };
        
        // 값이 있는 경우만 업데이트 (null이 아닌 경우)
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
        
        // 변경사항이 있는지 확인
        const hasChanges = 
          (mapping.fg_classification !== null && mapping.fg_classification !== undefined && mapping.fg_classification !== record.fg_classification) ||
          (mapping.category !== null && mapping.category !== undefined && mapping.category !== record.category) ||
          (mapping.model !== null && mapping.model !== undefined && mapping.model !== record.model) ||
          (mapping.product !== null && mapping.product !== undefined && mapping.product !== record.product);
        
        // 디버깅: 270S_O 관련
        if (itemNumber === '270S_O' || itemNumber === '270S_0') {
          console.log(`   🔍 ${itemNumber} hasChanges:`, hasChanges);
          console.log(`      mapping.fg: "${mapping.fg_classification}", current.fg: "${record.fg_classification}"`);
          console.log(`      updateData:`, updateData);
        }
        
        if (hasChanges) {
          updates.push(updateData);
        }
      }
      
      // 배치 업데이트 (개별 업데이트로 처리)
      if (updates.length > 0) {
        let batchUpdated = 0;
        
        for (let i = 0; i < updates.length; i += BATCH_SIZE) {
          const batch = updates.slice(i, i + BATCH_SIZE);
          
          // 각 레코드를 개별적으로 업데이트
          const updatePromises = batch.map(async (updateData) => {
            const { id, ...fieldsToUpdate } = updateData;
            
            // 디버깅: 270S_O 관련
            const is270S = fieldsToUpdate.fg_classification === 'FG';
            if (is270S) {
              console.log(`   🔍 Updating ${id} with:`, JSON.stringify(fieldsToUpdate));
            }
            
            // UPDATE 전 현재 값 확인
            if (is270S) {
              const { data: beforeData } = await supabase
                .from('sales_data')
                .select('item_number, fg_classification')
                .eq('id', id)
                .single();
              if (beforeData) {
                console.log(`      Before: ${beforeData.item_number} fg=${beforeData.fg_classification}`);
              }
            }
            
            const { data, error: updateError } = await supabase
              .from('sales_data')
              .update(fieldsToUpdate)
              .eq('id', id)
              .select('id, item_number, fg_classification, category, model, product');
            
            if (updateError) {
              console.error(`❌ Update error for ${id}:`, updateError.message);
              if (is270S) {
                console.error(`   Failed to update 270S_O with:`, fieldsToUpdate);
              }
              return false;
            }
            
            // 디버깅: 270S_O 관련
            if (data && data.length > 0) {
              const updated = data[0];
              if (updated.item_number === '270S_O' || updated.item_number === '270S_0') {
                console.log(`      After: ${updated.item_number} fg=${updated.fg_classification}`);
                console.log(`      Expected: fg=FG, Got: fg=${updated.fg_classification}`);
                if (updated.fg_classification !== 'FG') {
                  console.error(`   ⚠️ UPDATE FAILED: Value not changed!`);
                }
              }
            }
            
            return true;
          });
          
          const results = await Promise.allSettled(updatePromises);
          const successCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
          batchUpdated += successCount;
          totalUpdated += successCount;
          
          if (i + BATCH_SIZE < updates.length) {
            await delay(DELAY_MS);
          }
        }
        
        console.log(`   ✅ Updated ${batchUpdated} out of ${updates.length} records`);
      } else {
        console.log(`   ⏭️  No updates needed for this page`);
      }
      
      totalProcessed += records.length;
      
      if (records.length < 1000) break;
      page++;
      
      await delay(DELAY_MS);
    }
    
    console.log(`\n✅ Update completed!`);
    console.log(`   Total processed: ${totalProcessed} records`);
    console.log(`   Total updated: ${totalUpdated} records`);
    
    // 4. 결과 확인 (270S_0/270S_O 예시)
    console.log(`\n📊 Checking result for 270S_0/270S_O...`);
    
    // item_mapping에서 270S_0와 270S_O 모두 확인
    const { data: mappingCheck0 } = await supabase
      .from('item_mapping')
      .select('item_number, fg_classification, category, model, product, is_active')
      .eq('entity', 'Japan')
      .in('item_number', ['270S_0', '270S_O'])
      .limit(10);
    
    if (mappingCheck0 && mappingCheck0.length > 0) {
      console.log(`   📋 Found in item_mapping (270S_0 or 270S_O):`);
      mappingCheck0.forEach(item => {
        console.log(`      ${item.item_number}: fg=${item.fg_classification}, active=${item.is_active}`);
      });
    } else {
      console.log(`   ⚠️  No 270S_0 or 270S_O found in item_mapping for Japan`);
      
      // 모든 270S로 시작하는 항목 확인
      const { data: mappingCheckAll } = await supabase
        .from('item_mapping')
        .select('item_number, fg_classification, category, model, product, is_active')
        .eq('entity', 'Japan')
        .like('item_number', '270S%')
        .limit(10);
      
      if (mappingCheckAll && mappingCheckAll.length > 0) {
        console.log(`   📋 All 270S% items in item_mapping:`);
        mappingCheckAll.forEach(item => {
          console.log(`      ${item.item_number}: fg=${item.fg_classification}, active=${item.is_active}`);
        });
      }
    }
    
    // sales_data에서 270S_0/270S_O 확인
    const { data: checkData } = await supabase
      .from('sales_data')
      .select('item_number, fg_classification, category, model, product')
      .eq('entity', 'Japan')
      .in('item_number', ['270S_0', '270S_O'])
      .limit(5);
    
    if (checkData && checkData.length > 0) {
      console.log(`   📊 Current in sales_data (270S_0 or 270S_O):`);
      checkData.forEach(record => {
        console.log(`      ${record.item_number}: fg=${record.fg_classification}, category=${record.category}`);
      });
    } else {
      // LIKE로 다시 확인
      const { data: checkDataLike } = await supabase
        .from('sales_data')
        .select('item_number, fg_classification, category, model, product')
        .eq('entity', 'Japan')
        .like('item_number', '270S%')
        .limit(5);
      
      if (checkDataLike) {
        console.log(`   📊 Current in sales_data (270S%):`);
        checkDataLike.forEach(record => {
          console.log(`      ${record.item_number}: fg=${record.fg_classification}, category=${record.category}`);
        });
      }
    }
    
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
