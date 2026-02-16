// app/api/upload/process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createServiceClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

// Route Segment Config for larger file processing
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  let batchId = '';
  let historyId: string | null = null; // catch 블록에서 사용하기 위해 함수 스코프에 선언
  
  try {
    console.log('📥 File processing request received');

    // 1. Parse request body
    const body = await request.json();
    const { storagePath, entity, fileName, historyId: bodyHistoryId, columnMapping } = body;
    historyId = bodyHistoryId || null; // body에서 추출한 값을 함수 스코프 변수에 할당

    console.log('📄 Storage Path:', storagePath);
    console.log('🏢 Entity:', entity);
    console.log('📝 File Name:', fileName);
    console.log('📋 History ID:', historyId);

    // 2. Validate inputs
    if (!storagePath || !entity || !fileName) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // 3. Create Supabase client
    const supabase = createServiceClient();

    // Entities that require item mapping (Japan, China, India, Mexico, Oceania, Netherlands, Germany, UK, Asia, Europe)
    const entitiesRequiringItemMapping = ['Japan', 'China', 'India', 'Mexico', 'Oceania', 'Netherlands', 'Germany', 'UK', 'Asia', 'Europe'];
    const requiresItemMapping = entitiesRequiringItemMapping.includes(entity);

    // 3.1. Load item mapping with fallback logic:
    // 1. First check item_master (master table, no entity needed)
    // 2. If not found in master, check item_mapping (entity-specific)
    let itemMappingMap: Map<string, { fg_classification?: string; category?: string; model?: string; product?: string }> = new Map();
    if (requiresItemMapping) {
      console.log(`🔍 Loading item mappings (master first, then entity-specific)...`);
      
      // Load both item_master and item_mapping
      const [masterResult, mappingResult] = await Promise.all([
        supabase
          .from('item_master')
          .select('item_number, fg_classification, category, model, product')
          .eq('is_active', true),
        supabase
          .from('item_mapping')
          .select('item_number, fg_classification, category, model, product')
          .eq('entity', entity)
          .eq('is_active', true),
      ]);

      const { data: itemMasters, error: itemMasterError } = masterResult;
      const { data: itemMappings, error: itemMappingError } = mappingResult;

      // Helper function to normalize item_number (trim and handle case)
      const normalizeItemNumber = (itemNumber: string | null | undefined): string | null => {
        if (!itemNumber) return null;
        const trimmed = itemNumber.toString().trim();
        return trimmed === '' ? null : trimmed;
      };

      // First, load all item_master mappings (priority)
      if (!itemMasterError && itemMasters && itemMasters.length > 0) {
        let masterCount = 0;
        itemMasters.forEach((mapping: any) => {
          const normalizedItemNumber = normalizeItemNumber(mapping.item_number);
          if (normalizedItemNumber) {
            itemMappingMap.set(normalizedItemNumber, {
              fg_classification: mapping.fg_classification || undefined,
              category: mapping.category || undefined,
              model: mapping.model || undefined,
              product: mapping.product || undefined,
            });
            masterCount++;
          }
        });
        console.log(`✅ Loaded ${masterCount} item mappings from item_master (${itemMasters.length} total, ${itemMasters.length - masterCount} skipped due to empty item_number)`);
      } else if (itemMasterError && itemMasterError.code !== '42P01') {
        // Only warn if it's not a "table doesn't exist" error
        console.warn('⚠️ Failed to load item_master:', itemMasterError.message);
      }

      // Then, load item_mapping for items not found in master (fallback)
      if (!itemMappingError && itemMappings && itemMappings.length > 0) {
        let fallbackCount = 0;
        itemMappings.forEach((mapping: any) => {
          const normalizedItemNumber = normalizeItemNumber(mapping.item_number);
          if (normalizedItemNumber) {
            // Only add if not already in map (master has priority)
            if (!itemMappingMap.has(normalizedItemNumber)) {
              itemMappingMap.set(normalizedItemNumber, {
                fg_classification: mapping.fg_classification || undefined,
                category: mapping.category || undefined,
                model: mapping.model || undefined,
                product: mapping.product || undefined,
              });
              fallbackCount++;
            }
          }
        });
        if (fallbackCount > 0) {
          console.log(`✅ Loaded ${fallbackCount} additional item mappings from item_mapping (entity: ${entity})`);
        }
      } else if (itemMappingError && itemMappingError.code !== '42P01') {
        // Only warn if it's not a "table doesn't exist" error
        console.warn('⚠️ Failed to load item_mapping:', itemMappingError.message);
      }

      console.log(`📊 Total ${itemMappingMap.size} item mappings loaded (master + entity-specific fallback)`);
    }

    // 4. Download file from Supabase Storage
    console.log('📥 Downloading file from storage...');
    const { downloadFile } = await import('@/lib/utils/storage');
    
    let fileData: Blob;
    try {
      fileData = await downloadFile(storagePath);
      console.log('✅ File downloaded successfully');
    } catch (downloadError) {
      console.error('❌ Download error:', downloadError);
      return NextResponse.json(
        { success: false, error: 'Failed to download file from storage', details: (downloadError as Error).message },
        { status: 500 }
      );
    }

    // 5. Convert Blob to ArrayBuffer and parse Excel
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📊 Parsed ${jsonData.length} rows from Excel`);

    if (jsonData.length === 0) {
      // 히스토리 업데이트
      if (historyId) {
        await supabase
          .from('upload_history')
          .update({
            status: 'failed',
            error_message: 'Excel file is empty',
          })
          .eq('id', historyId);
      }
      return NextResponse.json(
        { success: false, error: 'Excel file is empty' },
        { status: 400 }
      );
    }

    // 6. Use existing historyId or create new one
    if (historyId) {
      batchId = historyId;
    } else {
      batchId = uuidv4();
      // 새 히스토리 생성
      const { error: historyError } = await supabase
        .from('upload_history')
        .insert({
          batch_id: batchId,
          entity: entity,
          file_name: fileName,
          storage_path: storagePath,
          rows_uploaded: jsonData.length,
          status: 'processing',
        });

      if (historyError) {
        console.error('❌ History insert error:', historyError);
      }
    }

    // 8. Transform and insert data
    console.log('🔄 Transforming data...');
    
    // Load column mapping from database if not provided
    let columnMap: { [key: string]: string } = {};
    
    if (columnMapping && Object.keys(columnMapping).length > 0) {
      // Use provided mapping
      columnMap = columnMapping;
      console.log(`📋 Using provided column mapping (${Object.keys(columnMap).length} mappings)`);
    } else {
      // Try to load from database
      try {
        const mappingResponse = await supabase
          .from('column_mapping')
          .select('excel_column, db_column')
          .eq('entity', entity)
          .eq('is_active', true);
        
        if (mappingResponse.data && mappingResponse.data.length > 0) {
          mappingResponse.data.forEach((row: any) => {
            columnMap[row.excel_column] = row.db_column;
          });
          console.log(`📋 Loaded column mapping from database (${Object.keys(columnMap).length} mappings)`);
        } else {
          // Use default mapping
          console.log('📋 Using default column mapping');
          columnMap = {
            'Sales Type': 'sales_type',
            'Invoice': 'invoice',
            'Voucher': 'voucher',
            'Invoice date': 'invoice_date',
            'Pool': 'pool',
            'Supply method': 'supply_method',
            'Sub Method - 1': 'sub_method_1',
            'Sub Method - 2': 'sub_method_2',
            'Sub Method - 3': 'sub_method_3',
            'Application': 'application',
            'Industry': 'industry',
            'Sub Industry - 1': 'sub_industry_1',
            'Sub Industry - 2': 'sub_industry_2',
            'General group': 'general_group',
            'Sales order': 'sales_order',
            'Account number': 'account_number',
            'Name': 'name',
            'Name2': 'name2',
            'Customer invoice account': 'customer_invoice_account',
            'Invoice account': 'invoice_account',
            'Group': 'group',
            'Currency': 'currency',
            'Invoice Amount': 'invoice_amount',
            'Invoice Amount_MST': 'invoice_amount_mst',
            'Sales tax amount': 'sales_tax_amount',
            'The sales tax amount, in the accounting currency': 'sales_tax_amount_accounting',
            'Total for invoice': 'total_for_invoice',
            'Total_MST': 'total_mst',
            'Open balance': 'open_balance',
            'Due date': 'due_date',
            'Sales tax group': 'sales_tax_group',
            'Payment type': 'payment_type',
            'Terms of payment': 'terms_of_payment',
            'Payment schedule': 'payment_schedule',
            'Method of payment': 'method_of_payment',
            'Posting profile': 'posting_profile',
            'Delivery terms': 'delivery_terms',
            'H_DIM_WK': 'h_dim_wk',
            'H_WK_NAME': 'h_wk_name',
            'H_DIM_CC': 'h_dim_cc',
            'H DIM NAME': 'h_dim_name',
            'Line number': 'line_number',
            'Street': 'street',
            'City': 'city',
            'State': 'state',
            'ZIP/postal code': 'zip_postal_code',
            'Final ZipCode': 'final_zipcode',
            'Region': 'region',
            'Product type': 'product_type',
            'Item group': 'item_group',
            'Category': 'category',
            'Model': 'model',
            'Item number': 'item_number',
            'Product name': 'product_name',
            'Text': 'text',
            'Warehouse': 'warehouse',
            'Name3': 'name3',
            'Quantity': 'quantity',
            'Inventory unit': 'inventory_unit',
            'Price unit': 'price_unit',
            'Net amount': 'net_amount',
            'Line Amount_MST': 'line_amount_mst',
            'Sales tax group2': 'sales_tax_group2',
            'TaxItemGroup': 'tax_item_group',
            'Mode of delivery': 'mode_of_delivery',
            'Dlv Detail': 'dlv_detail',
            'Online order': 'online_order',
            'Sales channel': 'sales_channel',
            'Promotion': 'promotion',
            '2nd Sales': 'second_sales',
            'Personnel number': 'personnel_number',
            'WORKERNAME': 'worker_name',
            'L DIM NAME': 'l_dim_name',
            'L_DIM_WK': 'l_dim_wk',
            'L_WK_NAME': 'l_wk_name',
            'L_DIM_CC': 'l_dim_cc',
            'Main account': 'main_account',
            'Account name': 'account_name',
            'Rebate': 'rebate',
            'Description': 'description',
            'Country': 'country',
            'CREATEDDATE': 'created_date',
            'CREATEDBY': 'created_by',
            'Exception': 'exception',
            'With collection agency': 'with_collection_agency',
            'Credit rating': 'credit_rating',
          };
        }
      } catch (mappingError) {
        console.warn('⚠️ Failed to load column mapping, using default:', mappingError);
        // Use default mapping as fallback
        columnMap = {
          'Sales Type': 'sales_type',
          'Invoice': 'invoice',
          'Voucher': 'voucher',
          'Invoice date': 'invoice_date',
          'Pool': 'pool',
          'Supply method': 'supply_method',
          'Sub Method - 1': 'sub_method_1',
          'Sub Method - 2': 'sub_method_2',
          'Sub Method - 3': 'sub_method_3',
          'Application': 'application',
          'Industry': 'industry',
          'Sub Industry - 1': 'sub_industry_1',
          'Sub Industry - 2': 'sub_industry_2',
          'General group': 'general_group',
          'Sales order': 'sales_order',
          'Account number': 'account_number',
          'Name': 'name',
          'Name2': 'name2',
          'Customer invoice account': 'customer_invoice_account',
          'Invoice account': 'invoice_account',
          'Group': 'group',
          'Currency': 'currency',
          'Invoice Amount': 'invoice_amount',
          'Invoice Amount_MST': 'invoice_amount_mst',
          'Sales tax amount': 'sales_tax_amount',
          'The sales tax amount, in the accounting currency': 'sales_tax_amount_accounting',
          'Total for invoice': 'total_for_invoice',
          'Total_MST': 'total_mst',
          'Open balance': 'open_balance',
          'Due date': 'due_date',
          'Sales tax group': 'sales_tax_group',
          'Payment type': 'payment_type',
          'Terms of payment': 'terms_of_payment',
          'Payment schedule': 'payment_schedule',
          'Method of payment': 'method_of_payment',
          'Posting profile': 'posting_profile',
          'Delivery terms': 'delivery_terms',
          'H_DIM_WK': 'h_dim_wk',
          'H_WK_NAME': 'h_wk_name',
          'H_DIM_CC': 'h_dim_cc',
          'H DIM NAME': 'h_dim_name',
          'Line number': 'line_number',
          'Street': 'street',
          'City': 'city',
          'State': 'state',
          'ZIP/postal code': 'zip_postal_code',
          'Final ZipCode': 'final_zipcode',
          'Region': 'region',
          'Product type': 'product_type',
          'Item group': 'item_group',
          'Category': 'category',
          'Model': 'model',
          'Item number': 'item_number',
          'Product name': 'product_name',
          'Text': 'text',
          'Warehouse': 'warehouse',
          'Name3': 'name3',
          'Quantity': 'quantity',
          'Inventory unit': 'inventory_unit',
          'Price unit': 'price_unit',
          'Net amount': 'net_amount',
          'Line Amount_MST': 'line_amount_mst',
          'Sales tax group2': 'sales_tax_group2',
          'TaxItemGroup': 'tax_item_group',
          'Mode of delivery': 'mode_of_delivery',
          'Dlv Detail': 'dlv_detail',
          'Online order': 'online_order',
          'Sales channel': 'sales_channel',
          'Promotion': 'promotion',
          '2nd Sales': 'second_sales',
          'Personnel number': 'personnel_number',
          'WORKERNAME': 'worker_name',
          'L DIM NAME': 'l_dim_name',
          'L_DIM_WK': 'l_dim_wk',
          'L_WK_NAME': 'l_wk_name',
          'L_DIM_CC': 'l_dim_cc',
          'Main account': 'main_account',
          'Account name': 'account_name',
          'Rebate': 'rebate',
          'Description': 'description',
          'Country': 'country',
          'CREATEDDATE': 'created_date',
          'CREATEDBY': 'created_by',
          'Exception': 'exception',
          'With collection agency': 'with_collection_agency',
          'Credit rating': 'credit_rating',
        };
      }
    }

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

    function getQuarter(dateStr: string | null): string | null {
      if (!dateStr) return null;
      const month = parseInt(dateStr.split('-')[1]);
      if (month >= 1 && month <= 3) return 'Q1';
      if (month >= 4 && month <= 6) return 'Q2';
      if (month >= 7 && month <= 9) return 'Q3';
      if (month >= 10 && month <= 12) return 'Q4';
      return null;
    }

    // 숫자 필드 변환 함수 (문자열 "No", "Yes" 등을 null로 처리)
    function parseNumeric(value: any): number | null {
      if (value === undefined || value === null || value === '') {
        return null;
      }
      
      // 문자열이 "No", "Yes", "N/A" 등인 경우 null 반환
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '' || 
            trimmed.toLowerCase() === 'no' || 
            trimmed.toLowerCase() === 'yes' ||
            trimmed.toLowerCase() === 'n/a' ||
            trimmed.toLowerCase() === 'na' ||
            trimmed.toLowerCase() === 'null' ||
            trimmed.toLowerCase() === 'undefined') {
          return null;
        }
      }
      
      // 숫자로 변환 시도
      const num = typeof value === 'number' ? value : Number(value);
      return isNaN(num) ? null : num;
    }

    // Channel 계산 함수
    function calculateChannel(entity: string, group: string | null, invoiceAccount: string | null): string | null {
      if (!entity || !group) return null;
      
      const entityUpper = entity.toUpperCase();
      const groupStr = group?.toString().trim() || '';
      const invoiceAccountStr = invoiceAccount?.toString().trim() || '';

      // China: Group에 따라 특정 Channel 매핑
      if (entityUpper === 'CHINA') {
        if (groupStr === 'CG12' || groupStr === 'Direct') {
          return 'Direct';
        } else if (groupStr === 'CG22') {
          return 'Inter-Company';
        }
        return groupStr || null;
      }

      // Oceania, India, Japan, Mexico, Netherlands, Germany, UK, Asia, Europe: group 값을 그대로 channel로 사용
      if (['OCEANIA', 'INDIA', 'JAPAN', 'MEXICO', 'NETHERLANDS', 'GERMANY', 'UK', 'ASIA', 'EUROPE'].includes(entityUpper)) {
        return groupStr || null;
      }

      // HQ entity
      if (entityUpper === 'HQ') {
        if (groupStr === 'CG11' || groupStr === 'CG31') {
          // Check if invoice_account is in Distributor list
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
          // Check if invoice_account is in Distributor list
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
          // Check if invoice_account is in Distributor list
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

    // 숫자 타입 컬럼 목록
    const numericColumns = [
      'line_number',
      'quantity',
      'price_unit',
      'net_amount',
      'line_amount_mst',
      'rebate',
      'invoice_amount',
      'invoice_amount_mst',
      'sales_tax_amount',
      'sales_tax_amount_accounting',
      'total_for_invoice',
      'total_mst',
      'open_balance',
      'year',
    ];

    // Japan 엔티티의 경우: 매핑 테이블에 없는 컬럼은 필터링
    const isJapanEntity = entity === 'Japan';
    let filteredJsonData = jsonData;
    
    if (isJapanEntity && Object.keys(columnMap).length > 0) {
      // 매핑에 있는 컬럼만 유지
      const mappedColumns = Object.keys(columnMap);
      filteredJsonData = jsonData.map((row: any) => {
        const filteredRow: any = {};
        mappedColumns.forEach((excelCol) => {
          if (row.hasOwnProperty(excelCol)) {
            filteredRow[excelCol] = row[excelCol];
          }
        });
        return filteredRow;
      });
      
      const originalColumnCount = jsonData.length > 0 ? Object.keys(jsonData[0] as Record<string, any>).length : 0;
      const filteredColumnCount = mappedColumns.length;
      console.log(`🇯🇵 Japan entity: Filtered columns from ${originalColumnCount} to ${filteredColumnCount} mapped columns`);
    }

    const transformedData = filteredJsonData.map((row: any) => {
      const transformed: any = {
        entity: entity,
        upload_batch_id: batchId,
      };

      for (const [excelCol, dbCol] of Object.entries(columnMap)) {
        const value = row[excelCol];
        
        if (dbCol === 'invoice_date' || dbCol === 'due_date' || dbCol === 'created_date') {
          transformed[dbCol] = parseDate(value);
          
          if (dbCol === 'invoice_date' && transformed[dbCol]) {
            transformed.year = parseInt(transformed[dbCol].split('-')[0]);
            transformed.quarter = getQuarter(transformed[dbCol]);
          }
        } else if (numericColumns.includes(dbCol)) {
          // 숫자 타입 컬럼은 parseNumeric으로 변환
          const numValue = parseNumeric(value);
          if (numValue !== null) {
            transformed[dbCol] = numValue;
          }
        } else if (value !== undefined && value !== null && value !== '') {
          // 문자열 타입 컬럼은 그대로 사용
          transformed[dbCol] = value;
        }
      }

      // Industry가 NULL이면 'Other'로 설정
      if (!transformed.industry || transformed.industry === null || transformed.industry === '') {
        transformed.industry = 'Other';
      }

      // Channel 계산 및 추가
      const channel = calculateChannel(
        entity,
        transformed.group || null,
        transformed.invoice_account || null
      );
      if (channel) {
        transformed.channel = channel;
      }

      // Item Mapping 적용 (Japan, China 등)
      // 규칙: 1) item_master에 동일 item_number가 있으면 먼저 mapping
      //       2) 없다면 item_mapping에서 동일 entity의 값을 가져오기
      if (requiresItemMapping && transformed.item_number) {
        // Normalize item_number (trim whitespace)
        const normalizedItemNumber = transformed.item_number.toString().trim();
        if (normalizedItemNumber) {
          const itemMapping = itemMappingMap.get(normalizedItemNumber);
          if (itemMapping) {
            // 매핑된 값이 있으면 덮어쓰기 (null이 아닌 값만)
            if (itemMapping.fg_classification !== undefined && itemMapping.fg_classification !== null) {
              transformed.fg_classification = itemMapping.fg_classification;
            }
            if (itemMapping.category !== undefined && itemMapping.category !== null) {
              transformed.category = itemMapping.category;
            }
            if (itemMapping.model !== undefined && itemMapping.model !== null) {
              transformed.model = itemMapping.model;
            }
            if (itemMapping.product !== undefined && itemMapping.product !== null) {
              transformed.product = itemMapping.product;
            }
          } else {
            // Debug: Log when item_number is not found in mapping
            if (process.env.NODE_ENV === 'development') {
              console.log(`⚠️ Item number "${normalizedItemNumber}" not found in item mapping`);
            }
          }
        }
      }

      return transformed;
    });

    // 9. Insert data in batches
    const BATCH_SIZE = 250; // 배치 크기 더 감소 (500 -> 250)
    let totalInserted = 0;
    let totalSkipped = 0;
    const errors: any[] = [];
    const startTime = Date.now();
    const MAX_PROCESSING_TIME = 240 * 1000; // 240초 (4분) 타임아웃 - maxDuration(300초)보다 여유 있게

    // 타임아웃 체크 함수 (경고만, 에러는 발생시키지 않음)
    const checkTimeout = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_PROCESSING_TIME) {
        console.warn(`⏱️ Processing time exceeded ${MAX_PROCESSING_TIME / 1000}s, but continuing...`);
        // 타임아웃이 발생해도 계속 진행 (maxDuration이 더 길기 때문)
      }
    };

    // 재귀적으로 배치를 나눠서 삽입하는 함수 (이진 분할)
    const insertBatchRecursive = async (batch: any[], minSize: number = 10): Promise<{ inserted: number; skipped: number }> => {
      checkTimeout();

      // 최소 크기에 도달하면 개별 레코드 처리
      if (batch.length <= minSize) {
        let inserted = 0;
        let skipped = 0;

        // 개별 레코드를 병렬로 처리 (최대 5개씩)
        const PARALLEL_SIZE = 5;
        for (let i = 0; i < batch.length; i += PARALLEL_SIZE) {
          const parallelBatch = batch.slice(i, i + PARALLEL_SIZE);
          
          const results = await Promise.allSettled(
            parallelBatch.map(async (record) => {
              try {
                const { data, error } = await supabase
                  .from('sales_data')
                  .insert([record])
                  .select();

                if (error) {
                  if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
                    return { success: false, skipped: true };
                  } else {
                    errors.push({
                      record: { invoice: record.invoice, invoice_date: record.invoice_date, item_number: record.item_number },
                      error: error.message,
                    });
                    return { success: false, skipped: false };
                  }
                } else {
                  return { success: true, skipped: false };
                }
              } catch (recordError) {
                errors.push({
                  record: { invoice: record.invoice, invoice_date: record.invoice_date, item_number: record.item_number },
                  error: (recordError as Error).message,
                });
                return { success: false, skipped: false };
              }
            })
          );

          results.forEach((result) => {
            if (result.status === 'fulfilled') {
              if (result.value.success) {
                inserted++;
              } else if (result.value.skipped) {
                skipped++;
              }
            }
          });
        }

        return { inserted, skipped };
      }

      // 배치 삽입 시도
      try {
        const { data, error } = await supabase
          .from('sales_data')
          .insert(batch)
          .select();

        if (error) {
          // 중복 에러인 경우 배치를 반으로 나눠서 재시도
          if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
            // 중복 에러 상세 로깅
            console.log(`⚠️ Duplicate error in batch of ${batch.length} records. Error: ${error.message}`);
            if (batch.length <= 20) {
              // 작은 배치일 때는 샘플 레코드 로깅
              const sample = batch.slice(0, 3).map(r => ({
                entity: r.entity,
                invoice: r.invoice,
                invoice_date: r.invoice_date,
                item_number: r.item_number,
                line_number: r.line_number,
              }));
              console.log(`Sample records:`, JSON.stringify(sample, null, 2));
            }
            
            const mid = Math.floor(batch.length / 2);
            const firstHalf = batch.slice(0, mid);
            const secondHalf = batch.slice(mid);

            const firstResult = await insertBatchRecursive(firstHalf, minSize);
            const secondResult = await insertBatchRecursive(secondHalf, minSize);

            return {
              inserted: firstResult.inserted + secondResult.inserted,
              skipped: firstResult.skipped + secondResult.skipped,
            };
          } else {
            // 다른 에러는 기록하고 배치를 반으로 나눠서 재시도
            errors.push({
              batch: batch.length,
              error: error.message,
            });

            const mid = Math.floor(batch.length / 2);
            const firstHalf = batch.slice(0, mid);
            const secondHalf = batch.slice(mid);

            const firstResult = await insertBatchRecursive(firstHalf, minSize);
            const secondResult = await insertBatchRecursive(secondHalf, minSize);

            return {
              inserted: firstResult.inserted + secondResult.inserted,
              skipped: firstResult.skipped + secondResult.skipped,
            };
          }
        } else {
          // 성공
          return {
            inserted: data?.length || batch.length,
            skipped: 0,
          };
        }
      } catch (batchError) {
        // 예외 발생 시 배치를 반으로 나눠서 재시도
        const mid = Math.floor(batch.length / 2);
        const firstHalf = batch.slice(0, mid);
        const secondHalf = batch.slice(mid);

        const firstResult = await insertBatchRecursive(firstHalf, minSize);
        const secondResult = await insertBatchRecursive(secondHalf, minSize);

        return {
          inserted: firstResult.inserted + secondResult.inserted,
          skipped: firstResult.skipped + secondResult.skipped,
        };
      }
    };

    // 배치 단위로 처리
    for (let i = 0; i < transformedData.length; i += BATCH_SIZE) {
      checkTimeout();

      const batch = transformedData.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(transformedData.length / BATCH_SIZE);

      try {
        const result = await insertBatchRecursive(batch);
        totalInserted += result.inserted;
        totalSkipped += result.skipped;

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ Batch ${batchNumber}/${totalBatches}: ${result.inserted} inserted, ${result.skipped} skipped (${elapsed}s elapsed)`);
        
        // 배치 사이에 짧은 딜레이 추가 (서버 부하 감소)
        if (i + BATCH_SIZE < transformedData.length) {
          await new Promise(resolve => setTimeout(resolve, 50)); // 50ms 딜레이
        }
      } catch (error) {
        console.error(`❌ Batch ${batchNumber} error:`, error);
        // 에러가 발생해도 계속 진행 (부분 완료)
        errors.push({
          batch: batchNumber,
          error: (error as Error).message,
        });
      }
    }

    // 10. Update upload history
    const updateQuery = historyId 
      ? supabase.from('upload_history').update({
          status: errors.length > 0 ? 'partial' : 'success',
          rows_uploaded: totalInserted,
          error_message: errors.length > 0 
            ? JSON.stringify(errors) 
            : (totalSkipped > 0 ? `${totalSkipped} rows skipped (duplicates)` : null),
        }).eq('id', historyId)
      : supabase.from('upload_history').update({
          status: errors.length > 0 ? 'partial' : 'success',
          rows_uploaded: totalInserted,
          error_message: errors.length > 0 
            ? JSON.stringify(errors) 
            : (totalSkipped > 0 ? `${totalSkipped} rows skipped (duplicates)` : null),
        }).eq('batch_id', batchId);
    
    await updateQuery;

    console.log(`✅ Upload complete: ${totalInserted} rows inserted, ${totalSkipped} rows skipped`);

    // 데이터 업로드 완료 후 대시보드 캐시 갱신
    try {
      console.log('🔄 Refreshing dashboard cache...');
      const { error: refreshError } = await supabase.rpc('refresh_dashboard');
      if (refreshError) {
        console.warn('⚠️ Failed to refresh dashboard cache:', refreshError.message);
        // 대시보드 갱신 실패는 업로드 성공에 영향을 주지 않음
      } else {
        console.log('✅ Dashboard cache refreshed successfully');
      }
    } catch (refreshError) {
      console.warn('⚠️ Error refreshing dashboard cache:', refreshError);
      // 대시보드 갱신 실패는 업로드 성공에 영향을 주지 않음
    }

    return NextResponse.json({
      success: true,
      rowsInserted: totalInserted,
      rowsSkipped: totalSkipped,
      batchId,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('❌ Processing error:', error);
    
    if (historyId || batchId) {
      const supabase = createServiceClient();
      const updateQuery = historyId
        ? supabase.from('upload_history').update({
            status: 'failed',
            error_message: (error as Error).message,
          }).eq('id', historyId)
        : supabase.from('upload_history').update({
            status: 'failed',
            error_message: (error as Error).message,
          }).eq('batch_id', batchId);
      await updateQuery;
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process file',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
