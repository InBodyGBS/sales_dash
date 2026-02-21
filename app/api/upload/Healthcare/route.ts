// app/api/upload/Healthcare/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';

// Route Segment Config
export const runtime = 'nodejs'; // Edge runtime은 XLSX 라이브러리를 지원하지 않으므로 nodejs 사용
export const maxDuration = 60; // 60초로 제한

// 제거할 컬럼 목록
const COLUMNS_TO_REMOVE = [
  'Voucher', 'Pool', 'Supply method', 'Sub Method - 1', 'Sub Method - 2', 
  'Sub Method - 3', 'Application', 'Sub Industry - 1', 'Sub Industry - 2', 
  'General group', 'Account number', 'Name', 'Name2', 'Invoice Amount', 
  'Invoice Amount_MST', 'Sales tax amount', 
  'The sales tax amount, in the accounting currency', 'Total for invoice', 
  'Total_MST', 'Open balance', 'Due date', 'Sales tax group', 'Payment type', 
  'Terms of payment', 'Payment schedule', 'Method of payment', 'Posting profile', 
  'Delivery terms', 'H_DIM_WK', 'H_WK_NAME', 'H_DIM_CC', 'H DIM NAME', 
  'Street', 'ZIP/postal code', 'Final ZipCode', 'Text', 
  'Warehouse', 'Name3', 'Inventory unit', 'Price unit', 'Sales tax group2', 
  'TaxItemGroup', 'Mode of delivery', 'Dlv Detail', 'Online order', 
  'Sales channel', 'Promotion', '2nd Sales', 'Main account', 'Account name', 
  'Rebate', 'Description', 'CREATEDDATE', 'CREATEDBY', 'Exception', 
  'With collection agency', 'Credit rating'
];

// 엑셀 컬럼명 → DB 컬럼명 매핑
const COLUMN_MAPPING: Record<string, string> = {
  'Sales Type': 'sales_type',
  'Invoice': 'invoice',
  'Invoice date': 'invoice_date',
  'Industry': 'industry',
  'Sales order': 'sales_order',
  'Customer invoice account': 'customer_invoice_account',
  'Invoice account': 'invoice_account',
  'Group': 'group',
  'Currency': 'currency',
  'City': 'city',
  'State': 'state',
  'Region': 'region',
  'Product type': 'product_type',
  'Item group': 'item_group',
  'Category': 'category',
  'Model': 'model',
  'Item number': 'item_number',
  'Product name': 'product_name',
  'Line number': 'line_number',
  'Quantity': 'quantity',
  'Net amount': 'net_amount',
  'Line Amount_MST': 'line_amount_mst',
  'Personnel number': 'personnel_number',
  'WORKERNAME': 'worker_name',
  'L DIM NAME': 'l_dim_name',
  'L_DIM_WK': 'l_dim_wk',
  'L_WK_NAME': 'l_wk_name',
  'L_DIM_CC': 'l_dim_cc',
  'Country': 'country',
};

// 날짜 파싱 함수
function parseDate(value: any): string | null {
  if (!value) return null;
  
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }
  
  if (typeof value === 'string') {
    const parsedDate = new Date(value);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split('T')[0];
    }
  }
  
  return null;
}

// Quarter 계산
function getQuarter(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const month = parseInt(dateStr.split('-')[1]);
  if (month >= 1 && month <= 3) return 'Q1';
  if (month >= 4 && month <= 6) return 'Q2';
  if (month >= 7 && month <= 9) return 'Q3';
  if (month >= 10 && month <= 12) return 'Q4';
  return null;
}

// Channel 계산 함수
function calculateChannel(entity: string, group: string | null, invoiceAccount: string | null): string | null {
  if (!entity) return null;
  
  const entityUpper = entity.toUpperCase();
  const groupStr = group?.toString().trim() || '';
  const invoiceAccountStr = invoiceAccount?.toString().trim() || '';

  // 이 엔티티들은 group 값을 그대로 channel로 사용 (group이 비어있어도 체크)
  // Japan, Oceania, India, Mexico, Netherlands, Germany, UK, Asia, Europe, Singapore, China
  if (['OCEANIA', 'INDIA', 'JAPAN', 'MEXICO', 'NETHERLANDS', 'GERMANY', 'UK', 'ASIA', 'EUROPE', 'SINGAPORE', 'CHINA'].includes(entityUpper)) {
    // group이 있으면 그대로 channel로 사용, 없으면 null
    return groupStr || null;
  }

  // group이 비어있으면 null 반환 (위 엔티티들 제외)
  if (!groupStr) return null;

  // HQ entity
  if (entityUpper === 'HQ') {
    if (groupStr === 'CG11' || groupStr === 'CG31') {
      const hqDistributors = [
        'HC000140', 'HC000282', 'HC000290', 'HC000382', 'HC000469',
        'HC000543', 'HC000586', 'HC000785', 'HC005195', 'HC005197',
        'HC005873', 'HC005974', 'HC012621'
      ];
      if (invoiceAccountStr && hqDistributors.includes(invoiceAccountStr)) {
        return 'Distributor';
      }
      return 'Direct';
    } else if (groupStr === 'CG12') {
      return 'Overseas';
    } else if (groupStr === 'CG21' || groupStr === 'CG22') {
      return 'Inter-Company';
    }
  }

  // KOROT entity
  if (entityUpper === 'KOROT') {
    if (groupStr === 'CG11' || groupStr === 'CG31') {
      const korotDistributors = [
        'KC000140', 'KC000282', 'KC000382', 'KC000469', 'KC000543',
        'KC000586', 'KC000785', 'KC005873', 'KC005974', 'KC010343',
        'KC010367'
      ];
      if (invoiceAccountStr && korotDistributors.includes(invoiceAccountStr)) {
        return 'Distributor';
      }
      return 'Direct';
    } else if (groupStr === 'CG12') {
      return 'Overseas';
    } else if (groupStr === 'CG21' || groupStr === 'CG22') {
      return 'Inter-Company';
    }
  }

  // Healthcare entity
  if (entityUpper === 'HEALTHCARE') {
    if (groupStr === 'CG11' || groupStr === 'CG31') {
      const healthcareDistributors = [
        'HCC000005', 'HCC000006', 'HCC000007', 'HCC000008', 'HCC000009',
        'HCC000010', 'HCC000011', 'HCC000012', 'HCC000013', 'HCC000273'
      ];
      if (invoiceAccountStr && healthcareDistributors.includes(invoiceAccountStr)) {
        return 'Distributor';
      }
      return 'Direct';
    } else if (groupStr === 'CG12') {
      return 'Overseas';
    } else if (groupStr === 'CG21' || groupStr === 'CG22') {
      return 'Inter-Company';
    }
  }

  // Vietnam entity
  if (entityUpper === 'VIETNAM') {
    if (groupStr === 'CG12' || groupStr === 'CG16' || groupStr === 'CG17' || groupStr === 'CG31') {
      return 'Direct';
    } else if (groupStr === 'CG13') {
      return 'Distributor';
    } else if (groupStr === 'CG14' || groupStr === 'CG15') {
      return 'Dealer';
    } else if (groupStr === 'CG21' || groupStr === 'CG22') {
      return 'Inter-Company';
    }
  }

  // BWA entity
  if (entityUpper === 'BWA') {
    const groupUpper = groupStr.toUpperCase();
    if (groupUpper === 'DOMESTIC' || groupUpper === 'ETC') {
      return 'Direct';
    } else if (groupUpper === 'INTERCOMPA') {
      return 'Inter-Company';
    } else if (groupUpper === 'OVERSEAS') {
      return 'Overseas';
    }
  }

  // USA entity
  if (entityUpper === 'USA') {
    if (invoiceAccountStr === 'UC000001') {
      return 'Distributor';
    }
    const groupUpper = groupStr.toUpperCase();
    if (groupUpper === 'DOMESTIC' || groupUpper === 'ETC') {
      return 'Direct';
    } else if (groupUpper === 'INTERCOMPA') {
      return 'Inter-Company';
    } else if (groupUpper === 'OVERSEAS') {
      return 'Overseas';
    }
  }

  return null;
}

// 필요한 컬럼만 추출하고 DB 컬럼명으로 변환
function filterAndMapColumns(data: any[], entity: string): any[] {
  if (!data || data.length === 0) return [];
  
  return data.map(row => {
    const mapped: any = {
      entity,
    };
    
    Object.keys(row).forEach(excelColumn => {
      // 제거 목록에 없고, 매핑에 있는 컬럼만 처리
      if (!COLUMNS_TO_REMOVE.includes(excelColumn) && COLUMN_MAPPING[excelColumn]) {
        const dbColumn = COLUMN_MAPPING[excelColumn];
        const value = row[excelColumn];
        
        // 날짜 컬럼 처리
        if (dbColumn === 'invoice_date') {
          mapped[dbColumn] = parseDate(value);
          
          if (mapped[dbColumn]) {
            mapped.year = parseInt(mapped[dbColumn].split('-')[0]);
            mapped.quarter = getQuarter(mapped[dbColumn]);
          }
        } else if (value !== undefined && value !== null && value !== '') {
          mapped[dbColumn] = value;
        }
      }
    });
    
    // Industry가 NULL이면 'Other'로 설정
    if (!mapped.industry || mapped.industry === null || mapped.industry === '') {
      mapped.industry = 'Other';
    }
    
    // Channel 계산 및 추가
    const channel = calculateChannel(
      entity,
      mapped.group || null,
      mapped.invoice_account || null
    );
    if (channel) {
      mapped.channel = channel;
    }
    
    return mapped;
  });
}

// 빈 행 제거
function removeEmptyRows(data: any[]): any[] {
  return data.filter(row => {
    // invoice나 주요 필드가 있는 행만 유지
    return row.invoice || row.sales_type || row.item_number;
  });
}

export async function POST(request: NextRequest) {
  const entity = 'Healthcare';
  let historyId: string | null = null;
  const startTime = Date.now();

  try {
    console.log(`📥 Upload request for entity: ${entity}`);

    // 타임아웃 체크를 위한 함수
    const checkTimeout = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > 55000) { // 55초 경과 시 타임아웃 에러 발생
        throw new Error('Request timeout: Processing took too long. Please try with a smaller file or contact support.');
      }
    };

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log(`📄 File: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    // 파일 크기 체크 (100MB 제한)
    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 100MB limit' },
        { status: 413 }
      );
    }

    checkTimeout();

    const supabase = createServiceClient();

    // 1. 업로드 히스토리 생성
    try {
      const { data: history, error: historyError } = await supabase
        .from('upload_history')
        .insert({
          entity,
          file_name: file.name,
          status: 'processing',
        })
        .select()
        .single();

      if (historyError) {
        throw new Error(`Failed to create upload history: ${historyError.message}`);
      }
      historyId = history.id;
    } catch (error) {
      throw new Error(`History creation failed: ${(error as Error).message}`);
    }

    checkTimeout();

    // 2. 원본 파일을 Supabase Storage에 업로드
    const timestamp = new Date().getTime();
    const storagePath = `${entity}/${timestamp}_${file.name}`;

    try {
      const { data: storageData, error: storageError } = await supabase.storage
        .from('sales-files')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (storageError) {
        throw new Error(`Storage upload failed: ${storageError.message}`);
      }
    } catch (error) {
      throw new Error(`File storage failed: ${(error as Error).message}`);
    }

    console.log(`✅ File uploaded to storage: ${storagePath}`);

    checkTimeout();

    // 3. 파일 파싱
    let rawData: any[];
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      rawData = XLSX.utils.sheet_to_json(worksheet);
      
      if (!rawData || rawData.length === 0) {
        throw new Error('Excel file is empty or could not be parsed');
      }
    } catch (error) {
      throw new Error(`File parsing failed: ${(error as Error).message}`);
    }

    console.log(`📊 원본 데이터: ${rawData.length}개 행`);

    checkTimeout();

    // 4. 데이터 정제 및 매핑
    let filteredData: any[];
    try {
      filteredData = filterAndMapColumns(rawData, entity);
      console.log(`🔧 컬럼 필터링 및 매핑 후: ${Object.keys(filteredData[0] || {}).length}개 컬럼`);

      // 빈 행 제거
      filteredData = removeEmptyRows(filteredData);
      console.log(`🗑️ 빈 행 제거 후: ${filteredData.length}개 행`);
    } catch (error) {
      throw new Error(`Data processing failed: ${(error as Error).message}`);
    }

    checkTimeout();

    // ============================================
    // 🔑 통합 중복 검증 로직 (모든 Entity 공통)
    // entity + invoice + customer_invoice_account 그룹의 line_amount_mst 합계 비교
    // ============================================
    console.log(`🔍 [${entity}] Unified duplicate check: entity + invoice + customer_invoice_account → SUM(line_amount_mst)`);
    
    const originalCount = filteredData.length;

    // Step A: 파일 내에서 (invoice, customer_invoice_account) 그룹별 합계 계산
    type InvoiceGroup = { invoice: string; customerInvoiceAccount: string; sum: number; rows: any[] };
    const uploadGroupMap = new Map<string, InvoiceGroup>();

    filteredData.forEach((row) => {
      const inv = (row.invoice || '').toString().trim();
      const acc = (row.customer_invoice_account || '').toString().trim();
      const key = `${inv}|${acc}`;
      const amount = parseFloat(row.line_amount_mst) || 0;

      if (!inv) return; // invoice가 없으면 스킵

      if (!uploadGroupMap.has(key)) {
        uploadGroupMap.set(key, { invoice: inv, customerInvoiceAccount: acc, sum: 0, rows: [] });
      }
      const g = uploadGroupMap.get(key)!;
      g.sum += amount;
      g.rows.push(row);
    });

    const uploadGroups = Array.from(uploadGroupMap.values());
    console.log(`📋 [${entity}] Upload file has ${uploadGroups.length} unique (invoice, customer_invoice_account) groups`);

    // Step B: DB에서 동일 (entity, invoice) 조합의 기존 데이터 조회
    const invoiceList = [...new Set(uploadGroups.map((g) => g.invoice).filter(Boolean))];
    console.log(`📋 [${entity}] Checking ${invoiceList.length} unique invoices in DB`);

    let dbGroupSums = new Map<string, number>(); // key: `invoice|account` → sum
    
    if (invoiceList.length > 0) {
      const BATCH_SIZE = 1000;
      let allDbRows: any[] = [];
      
      for (let i = 0; i < invoiceList.length; i += BATCH_SIZE) {
        const batchInvoices = invoiceList.slice(i, i + BATCH_SIZE);
        console.log(`🔍 [${entity}] Querying DB batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(invoiceList.length / BATCH_SIZE)} (${batchInvoices.length} invoices)...`);
        
        const { data: dbRows, error: dbError } = await supabase
          .from('sales_data')
          .select('invoice, customer_invoice_account, line_amount_mst')
          .eq('entity', entity)
          .in('invoice', batchInvoices);

        if (dbError) {
          console.error(`❌ [${entity}] DB duplicate check query failed (batch ${Math.floor(i / BATCH_SIZE) + 1}):`, dbError.message);
        } else if (dbRows && dbRows.length > 0) {
          allDbRows.push(...dbRows);
          console.log(`📊 [${entity}] Batch ${Math.floor(i / BATCH_SIZE) + 1}: Found ${dbRows.length} existing DB rows`);
        }
      }

      if (allDbRows.length > 0) {
        console.log(`📊 [${entity}] Total: Found ${allDbRows.length} existing DB rows for ${invoiceList.length} invoices`);

        allDbRows.forEach((row: any) => {
          const inv = (row.invoice || '').toString().trim();
          const acc = (row.customer_invoice_account || '').toString().trim();
          const key = `${inv}|${acc}`;
          const amount = parseFloat(row.line_amount_mst) || 0;
          dbGroupSums.set(key, (dbGroupSums.get(key) || 0) + amount);
        });
        
        console.log(`📊 [${entity}] Aggregated ${dbGroupSums.size} unique (invoice, account) groups from DB`);
      } else {
        console.log(`✅ [${entity}] No existing DB rows found for uploaded invoices → no duplicates`);
      }
    }

    // Step C: 합계 비교 → 중복 그룹만 제외하고 나머지는 업로드
    const allowedRows: any[] = [];
    let duplicateGroupCount = 0;
    let duplicateRowCount = 0;

    uploadGroups.forEach((group) => {
      const key = `${group.invoice}|${group.customerInvoiceAccount}`;
      const dbSum = dbGroupSums.get(key) ?? null;

      if (dbSum !== null && Math.abs(group.sum - dbSum) < 0.01) {
        // 합계가 동일 → 중복으로 판단, 해당 그룹 제외
        duplicateGroupCount++;
        duplicateRowCount += group.rows.length;
        if (duplicateGroupCount <= 10) {
          console.warn(`🚫 [${entity}] Duplicate group ${duplicateGroupCount} (skipped): invoice=${group.invoice}, account=${group.customerInvoiceAccount}, uploadSum=${group.sum.toFixed(2)}, dbSum=${dbSum.toFixed(2)}, rows=${group.rows.length}`);
        }
      } else {
        // 합계가 다르거나 DB에 없음 → 새 데이터로 허용
        allowedRows.push(...group.rows);
      }
    });

    if (duplicateGroupCount > 0) {
      console.log(`🚫 [${entity}] Skipped ${duplicateGroupCount} duplicate invoice group(s) containing ${duplicateRowCount} rows`);
      console.log(`📊 [${entity}] ${allowedRows.length} rows will be inserted`);
    } else {
      console.log(`✅ [${entity}] No duplicate invoice groups found → all ${allowedRows.length} rows will be inserted`);
    }

    // 중복 제거된 데이터로 교체
    filteredData = allowedRows;

    checkTimeout();

    // 5. DB에 저장 (배치 처리)
    const BATCH_SIZE = 50; // 100에서 50으로 감소하여 타임아웃 방지
    let totalInserted = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    // 딜레이 함수
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      for (let i = 0; i < filteredData.length; i += BATCH_SIZE) {
        checkTimeout(); // 각 배치 전에 타임아웃 체크

        const batch = filteredData.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(filteredData.length / BATCH_SIZE);

        // 재시도 로직 (최대 3번)
        let retries = 3;
        let batchSuccess = false;
        let lastError: any = null;

        while (retries > 0 && !batchSuccess) {
          try {
            const { data, error: insertError } = await supabase
              .from('sales_data')
              .insert(batch)
              .select();

            if (insertError) {
              // 중복 에러는 Skip으로 처리하고 재시도하지 않음
              if (insertError.code === '23505') {
                totalSkipped += batch.length;
                console.log(`⚠️ 배치 ${batchNumber}/${totalBatches}: 중복 데이터로 Skip`);
                batchSuccess = true; // 중복은 성공으로 간주
              } else {
                // 다른 에러는 재시도
                lastError = insertError;
                retries--;
                
                if (retries > 0) {
                  console.warn(`⚠️ 배치 ${batchNumber}/${totalBatches} 에러 발생, ${retries}번 남았습니다. 200ms 후 재시도...`, insertError.message);
                  await delay(200); // 실패 시 200ms 대기 후 재시도
                } else {
                  // 재시도 실패
                  const errorMsg = `Batch ${batchNumber}: ${insertError.message}`;
                  errors.push(errorMsg);
                  console.error(`❌ 배치 ${batchNumber}/${totalBatches} 최종 실패:`, insertError);
                  batchSuccess = true; // 재시도 실패했지만 다음 배치로 진행
                }
              }
            } else {
              // 성공
              totalInserted += data?.length || batch.length;
              console.log(`✅ 배치 ${batchNumber}/${totalBatches} 완료: ${data?.length || batch.length}개 저장`);
              batchSuccess = true;
            }
          } catch (batchError) {
            lastError = batchError;
            retries--;
            
            if (retries > 0) {
              console.warn(`⚠️ 배치 ${batchNumber}/${totalBatches} 예외 발생, ${retries}번 남았습니다. 200ms 후 재시도...`, (batchError as Error).message);
              await delay(200); // 실패 시 200ms 대기 후 재시도
            } else {
              // 재시도 실패
              const errorMsg = `Batch ${batchNumber} failed: ${(batchError as Error).message}`;
              errors.push(errorMsg);
              console.error(`❌ 배치 ${batchNumber}/${totalBatches} 최종 실패:`, batchError);
              batchSuccess = true; // 재시도 실패했지만 다음 배치로 진행
            }
          }
        }

        // 각 배치 사이 딜레이 (마지막 배치가 아닌 경우)
        if (i + BATCH_SIZE < filteredData.length) {
          await delay(100); // 100ms 딜레이
        }
      }
    } catch (error) {
      throw new Error(`Database insertion failed: ${(error as Error).message}`);
    }

    checkTimeout();

    // 6. 업로드 히스토리 업데이트
    try {
      await supabase
        .from('upload_history')
        .update({
          status: errors.length > 0 ? 'partial' : 'success',
          rows_uploaded: totalInserted,
          storage_path: storagePath,
          error_message: errors.length > 0 ? errors.join('; ') : (totalSkipped > 0 ? `${totalSkipped}개 행 Skip` : null),
        })
        .eq('id', historyId);
    } catch (error) {
      console.error('⚠️ History update failed:', error);
      // 히스토리 업데이트 실패는 치명적이지 않으므로 계속 진행
    }

    const spaceReduction = filteredData.length > 0 && rawData.length > 0
      ? ((1 - (Object.keys(filteredData[0] || {}).length / Object.keys(rawData[0] || {}).length)) * 100).toFixed(1)
      : '0';

    console.log(`🎉 Upload complete: ${totalInserted} rows inserted, ${totalSkipped} rows skipped`);

    return NextResponse.json({
      success: true,
      message: 'File uploaded and processed successfully',
      rowsInserted: totalInserted,
      rowsSkipped: totalSkipped,
      duplicateGroupsBlocked: duplicateGroupCount,
      duplicateRowsBlocked: duplicateRowCount,
      data: {
        historyId,
        fileName: file.name,
        originalRows: rawData.length,
        filteredRows: totalInserted,
        storagePath,
        columnsRemoved: COLUMNS_TO_REMOVE.length,
        spaceReduction: `${spaceReduction}%`,
        errors: errors.length > 0 ? errors : undefined,
      },
    });

  } catch (error) {
    console.error('❌ Upload error:', error);

    const errorMessage = (error as Error).message;
    const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('timeout');

    // 에러 발생 시 히스토리 업데이트
    if (historyId) {
      try {
        const supabase = createServiceClient();
        await supabase
          .from('upload_history')
          .update({
            status: 'failed',
            error_message: errorMessage,
          })
          .eq('id', historyId);
      } catch (updateError) {
        console.error('⚠️ Failed to update history:', updateError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: isTimeout 
          ? 'Request timeout: The file is too large or processing took too long. Please try with a smaller file or contact support.'
          : 'Upload failed',
        details: errorMessage,
      },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
