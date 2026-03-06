// app/api/upload/Healthcare/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';

// Route Segment Config
export const runtime = 'nodejs'; // Edge runtime은 XLSX 라이브러리를 지원하지 않으므로 nodejs 사용
export const maxDuration = 300; // 5분으로 제한 (큰 파일 처리 가능)

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

  if (['OCEANIA', 'INDIA', 'JAPAN', 'MEXICO', 'NETHERLANDS', 'GERMANY', 'UK', 'ASIA', 'EUROPE', 'SINGAPORE', 'CHINA', 'SAMHAN'].includes(entityUpper)) {
    return groupStr || 'Direct';
  }

  if (!groupStr) return null;

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
      if (!COLUMNS_TO_REMOVE.includes(excelColumn) && COLUMN_MAPPING[excelColumn]) {
        const dbColumn = COLUMN_MAPPING[excelColumn];
        const value = row[excelColumn];
        
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
    
    if (!mapped.industry || mapped.industry === null || mapped.industry === '') {
      mapped.industry = 'Other';
    }
    
    // FREETEXT 자동 채우기 로직
    const salesType = mapped.sales_type?.toString().trim().toUpperCase();
    const itemNumber = mapped.item_number?.toString().trim() || '';
    
    if (salesType === 'FREETEXT' && !itemNumber) {
      if (!mapped.category || mapped.category === '') {
        mapped.category = 'Others';
      }
      if (!mapped.model || mapped.model === '') {
        mapped.model = 'OTH_ETC';
      }
      if (!mapped.fg_classification || mapped.fg_classification === '') {
        mapped.fg_classification = 'NonFG';
      }
      if (!mapped.product || mapped.product === '') {
        mapped.product = 'ETC';
      }
    }
    
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
    return row.invoice || row.sales_type || row.item_number;
  });
}

export async function POST(request: NextRequest) {
  const entity = 'Healthcare';
  let historyId: string | null = null;
  const startTime = Date.now();

  try {
    console.log(`📥 Upload request for entity: ${entity}`);

    const checkTimeout = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > 280000) {
        throw new Error('Request timeout: Processing took too long. Please try with a smaller file or contact support.');
      }
    };

    let body: any;
    try {
      body = await request.json();
    } catch (error) {
      console.error('❌ Failed to parse request body:', error);
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid request format. Expected JSON with storagePath and fileName.' 
        },
        { status: 400 }
      );
    }

    const { storagePath, fileName } = body;

    if (!storagePath || !fileName) {
      console.error('❌ Missing required fields:', { storagePath: !!storagePath, fileName: !!fileName });
      return NextResponse.json(
        { 
          success: false,
          error: 'Storage path and file name are required' 
        },
        { status: 400 }
      );
    }

    console.log(`📄 File: ${fileName} at ${storagePath}`);

    checkTimeout();

    const supabase = createServiceClient();

    // 1. 업로드 히스토리 생성
    try {
      const { data: history, error: historyError } = await supabase
        .from('upload_history')
        .insert({
          entity,
          file_name: fileName,
          storage_path: storagePath,
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

    // 2. 파일을 Supabase Storage에서 다운로드
    let fileBuffer: ArrayBuffer;
    try {
      console.log(`📥 Downloading file from storage: ${storagePath}`);
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('sales-files')
        .download(storagePath);

      if (downloadError) {
        console.error('❌ Storage download error:', downloadError);
        throw new Error(`Failed to download file from storage: ${downloadError.message}`);
      }

      if (!fileData) {
        console.error('❌ No file data returned from storage');
        throw new Error('File not found in storage');
      }

      fileBuffer = await fileData.arrayBuffer();
      console.log(`✅ File downloaded from storage: ${storagePath} (${(fileBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
    } catch (error) {
      console.error('❌ File download failed:', error);
      throw new Error(`File download failed: ${(error as Error).message}`);
    }

    checkTimeout();

    // 3. 파일 파싱
    let rawData: any[];
    try {
      const workbook = XLSX.read(fileBuffer);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      rawData = XLSX.utils.sheet_to_json(worksheet);
      
      if (!rawData || rawData.length === 0) {
        throw new Error('Excel file is empty or could not be parsed');
      }
      
      if (rawData.length > 0) {
        const originalColumns = Object.keys(rawData[0]);
        console.log(`📋 Excel 파일의 원본 컬럼명 (${originalColumns.length}개):`, originalColumns);
        console.log(`🔍 'Invoice' 관련 컬럼 찾기:`, originalColumns.filter(col => col.toLowerCase().includes('invoice')));
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
      
      if (filteredData.length > 0) {
        console.log(`🔍 첫 번째 행의 키들:`, Object.keys(filteredData[0]));
        console.log(`🔍 첫 번째 행의 invoice 값:`, filteredData[0].invoice);
        console.log(`🔍 첫 번째 행의 customer_invoice_account 값:`, filteredData[0].customer_invoice_account);
      }

      filteredData = removeEmptyRows(filteredData);
      console.log(`🗑️ 빈 행 제거 후: ${filteredData.length}개 행`);
      
      const rowsWithInvoice = filteredData.filter(row => row.invoice && row.invoice.toString().trim());
      console.log(`📊 invoice가 있는 행: ${rowsWithInvoice.length}개`);
    } catch (error) {
      throw new Error(`Data processing failed: ${(error as Error).message}`);
    }

    checkTimeout();

    // ============================================
    // 🔑 행 단위 중복 검증 로직
    // 각 row를 (invoice, line_number) 기준으로 DB와 1:1 비교
    // line_number가 없는 경우 (invoice, item_number, line_amount_mst) 사용
    // → 중복인 행만 스킵, 새로운 행은 업로드
    // ============================================
    console.log(`🔍 [${entity}] Row-level duplicate check: (invoice, line_number) per row`);

    // Step A: 업로드 파일에서 invoice 목록 수집
    const invoiceSet = new Set<string>();
    let skippedRowsNoInvoice = 0;
    filteredData.forEach((row) => {
      const inv = (row.invoice || '').toString().trim();
      if (inv) {
        invoiceSet.add(inv);
      } else {
        skippedRowsNoInvoice++;
      }
    });

    if (skippedRowsNoInvoice > 0) {
      console.warn(`⚠️ invoice가 없어서 스킵된 행: ${skippedRowsNoInvoice}개`);
    }

    const invoiceList = [...invoiceSet];
    console.log(`📋 [${entity}] Upload has ${filteredData.length} rows across ${invoiceList.length} unique invoices`);

    // Step B: DB에서 동일 invoice의 기존 행 조회 → 행 단위 키 Set 생성
    // ⚠️ Supabase 기본 응답 한도(1000행)를 초과할 수 있으므로 페이지네이션 적용
    const dbExistingKeys = new Set<string>();

    const addDbRowsToKeySet = (rows: any[]) => {
      rows.forEach((row: any) => {
        const inv = (row.invoice || '').toString().trim();
        const lineNum = (row.line_number ?? '').toString().trim();
        const itemNum = (row.item_number || '').toString().trim();
        const amount = (parseFloat(row.line_amount_mst) || 0).toFixed(2);
        // 행 고유 키: line_number가 있으면 우선 사용, 없으면 item_number + amount
        const rowKey = lineNum
          ? `${inv}|L:${lineNum}`
          : `${inv}|I:${itemNum}|A:${amount}`;
        dbExistingKeys.add(rowKey);
      });
    };

    if (invoiceList.length > 0) {
      const INVOICE_BATCH_SIZE = 500; // 인보이스 배치 크기
      const PAGE_SIZE = 1000;         // Supabase 페이지 크기
      let totalDbRows = 0;

      for (let i = 0; i < invoiceList.length; i += INVOICE_BATCH_SIZE) {
        const batchInvoices = invoiceList.slice(i, i + INVOICE_BATCH_SIZE);
        const batchNum = Math.floor(i / INVOICE_BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(invoiceList.length / INVOICE_BATCH_SIZE);
        console.log(`🔍 [${entity}] Invoice batch ${batchNum}/${totalBatches} (${batchInvoices.length} invoices) - paginating...`);

        // 페이지네이션: 1000행씩 반복 조회
        let page = 0;
        let hasMore = true;
        let batchRowCount = 0;

        while (hasMore) {
          const from = page * PAGE_SIZE;
          const to = from + PAGE_SIZE - 1;

          const { data: pageRows, error: dbError } = await supabase
            .from('sales_data')
            .select('invoice, line_number, item_number, line_amount_mst')
            .eq('entity', entity)
            .in('invoice', batchInvoices)
            .range(from, to);

          if (dbError) {
            console.error(`❌ [${entity}] DB query failed (invoice batch ${batchNum}, page ${page + 1}):`, dbError.message);
            hasMore = false;
          } else if (pageRows && pageRows.length > 0) {
            addDbRowsToKeySet(pageRows);
            totalDbRows += pageRows.length;
            batchRowCount += pageRows.length;
            // 반환된 행이 PAGE_SIZE보다 적으면 마지막 페이지
            hasMore = pageRows.length === PAGE_SIZE;
            page++;
          } else {
            hasMore = false;
          }
        }

        if (batchRowCount > 0) {
          console.log(`📊 [${entity}] Invoice batch ${batchNum}: Found ${batchRowCount} existing DB rows (${page} page(s))`);
        }
      }
      console.log(`📊 [${entity}] Total DB existing keys: ${dbExistingKeys.size} (from ${totalDbRows} rows)`);
    } else {
      console.log(`✅ [${entity}] No invoices to check → all rows are new`);
    }

    // Step C: 각 업로드 행을 DB 키와 비교 → 새 행만 허용
    let duplicateRowCount = 0;
    const allowedRows: any[] = [];

    filteredData.forEach((row) => {
      const inv = (row.invoice || '').toString().trim();

      // invoice가 없는 행은 항상 허용
      if (!inv) {
        allowedRows.push(row);
        return;
      }

      const lineNum = (row.line_number ?? '').toString().trim();
      const itemNum = (row.item_number || '').toString().trim();
      const amount = (parseFloat(row.line_amount_mst) || 0).toFixed(2);

      const rowKey = lineNum
        ? `${inv}|L:${lineNum}`
        : `${inv}|I:${itemNum}|A:${amount}`;

      if (dbExistingKeys.has(rowKey)) {
        duplicateRowCount++;
        if (duplicateRowCount <= 5) {
          console.warn(`🚫 [${entity}] Duplicate row skipped (${duplicateRowCount}): invoice=${inv}, line=${lineNum || '-'}, item=${itemNum}, amount=${amount}`);
        }
      } else {
        allowedRows.push(row);
      }
    });

    const duplicateGroupCount = 0; // 하위 호환성을 위해 유지
    if (duplicateRowCount > 0) {
      console.log(`🚫 [${entity}] Skipped ${duplicateRowCount} duplicate rows → ${allowedRows.length} new rows will be inserted`);
    } else {
      console.log(`✅ [${entity}] No duplicate rows found → all ${allowedRows.length} rows will be inserted`);
    }

    // 중복 제거된 데이터로 교체
    filteredData = allowedRows;

    checkTimeout();

    // 5. DB에 저장 (배치 처리)
    const BATCH_SIZE = 50;
    let totalInserted = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      for (let i = 0; i < filteredData.length; i += BATCH_SIZE) {
        checkTimeout();

        const batch = filteredData.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(filteredData.length / BATCH_SIZE);

        let retries = 3;
        let batchSuccess = false;

        while (retries > 0 && !batchSuccess) {
          try {
            const { data, error: insertError } = await supabase
              .from('sales_data')
              .insert(batch)
              .select();

            if (insertError) {
              if (insertError.code === '23505') {
                totalSkipped += batch.length;
                console.log(`⚠️ 배치 ${batchNumber}/${totalBatches}: 중복 데이터로 Skip`);
                batchSuccess = true;
              } else {
                retries--;
                
                if (retries > 0) {
                  console.warn(`⚠️ 배치 ${batchNumber}/${totalBatches} 에러 발생, ${retries}번 남았습니다. 200ms 후 재시도...`, insertError.message);
                  await delay(200);
                } else {
                  const errorMsg = `Batch ${batchNumber}: ${insertError.message}`;
                  errors.push(errorMsg);
                  console.error(`❌ 배치 ${batchNumber}/${totalBatches} 최종 실패:`, insertError);
                  batchSuccess = true;
                }
              }
            } else {
              totalInserted += data?.length || batch.length;
              console.log(`✅ 배치 ${batchNumber}/${totalBatches} 완료: ${data?.length || batch.length}개 저장`);
              batchSuccess = true;
            }
          } catch (batchError) {
            retries--;
            
            if (retries > 0) {
              console.warn(`⚠️ 배치 ${batchNumber}/${totalBatches} 예외 발생, ${retries}번 남았습니다. 200ms 후 재시도...`, (batchError as Error).message);
              await delay(200);
            } else {
              const errorMsg = `Batch ${batchNumber} failed: ${(batchError as Error).message}`;
              errors.push(errorMsg);
              console.error(`❌ 배치 ${batchNumber}/${totalBatches} 최종 실패:`, batchError);
              batchSuccess = true;
            }
          }
        }

        if (i + BATCH_SIZE < filteredData.length) {
          await delay(100);
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
        fileName: fileName,
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
