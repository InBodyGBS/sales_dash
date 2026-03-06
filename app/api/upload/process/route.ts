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
  let historyId: string | null = null;
  
  try {
    console.log('📥 File processing request received');

    // 1. Parse request body
    const body = await request.json();
    const { storagePath, entity, fileName, historyId: bodyHistoryId, columnMapping } = body;
    historyId = bodyHistoryId || null;

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

    // Entities that require item mapping
    const entitiesRequiringItemMapping = ['Japan', 'China', 'India', 'Mexico', 'Oceania', 'Netherlands', 'Germany', 'UK', 'Asia', 'Europe', 'Singapore', 'Samhan'];
    const requiresItemMapping = entitiesRequiringItemMapping.includes(entity);

    // 3.1. Load item mapping with fallback logic
    let itemMappingMap: Map<string, { fg_classification?: string; category?: string; model?: string; product?: string }> = new Map();
    if (requiresItemMapping) {
      console.log(`🔍 Loading item mappings (master first, then entity-specific)...`);
      
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

      const normalizeItemNumber = (itemNumber: string | null | undefined): string | null => {
        if (!itemNumber) return null;
        const trimmed = itemNumber.toString().trim();
        return trimmed === '' ? null : trimmed;
      };

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
        console.log(`✅ Loaded ${masterCount} item mappings from item_master`);
      } else if (itemMasterError && itemMasterError.code !== '42P01') {
        console.warn('⚠️ Failed to load item_master:', itemMasterError.message);
      }

      if (!itemMappingError && itemMappings && itemMappings.length > 0) {
        let fallbackCount = 0;
        itemMappings.forEach((mapping: any) => {
          const normalizedItemNumber = normalizeItemNumber(mapping.item_number);
          if (normalizedItemNumber) {
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
        console.warn('⚠️ Failed to load item_mapping:', itemMappingError.message);
      }

      console.log(`📊 Total ${itemMappingMap.size} item mappings loaded`);
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
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: null });

    console.log(`📊 Parsed ${jsonData.length} rows from Excel`);

    if (jsonData.length > 0) {
      const firstRow = jsonData[0] as any;
      console.log('📅 First row date columns:', {
        Date: firstRow['Date'],
        DateType: typeof firstRow['Date'],
        isDate: firstRow['Date'] instanceof Date,
      });
    }

    if (jsonData.length === 0) {
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

    // 7. Load column mapping
    console.log('🔄 Transforming data...');
    
    let columnMap: { [key: string]: string } = {};
    
    if (columnMapping && Object.keys(columnMapping).length > 0) {
      columnMap = columnMapping;
      console.log(`📋 Using provided column mapping (${Object.keys(columnMap).length} mappings)`);
    } else {
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
          console.log('📋 Using default column mapping');
          columnMap = getDefaultColumnMapping();
        }
      } catch (mappingError) {
        console.warn('⚠️ Failed to load column mapping, using default:', mappingError);
        columnMap = getDefaultColumnMapping();
      }
    }

    // ============================================
    // parseDate 함수
    // ============================================
    function parseDate(value: any): string | null {
      if (!value) return null;
      
      if (value instanceof Date && !isNaN(value.getTime())) {
        const year = value.getUTCFullYear();
        const month = String(value.getUTCMonth() + 1).padStart(2, '0');
        const day = String(value.getUTCDate()).padStart(2, '0');
        if (year >= 1900 && year <= 2100) {
          return `${year}-${month}-${day}`;
        }
      }
      
      if (typeof value === 'number') {
        if (value > 0 && value < 100000) {
          const date = XLSX.SSF.parse_date_code(value);
          if (date) {
            return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
          }
        }
      }
      
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        
        const isoMatch = trimmed.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
        if (isoMatch) {
          const [, year, month, day] = isoMatch;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        
        const usMatch = trimmed.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
        if (usMatch) {
          const [, month, day, year] = usMatch;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        
        const euDotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (euDotMatch) {
          const [, day, month, year] = euDotMatch;
          if (parseInt(month) <= 12) {
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
        }
        
        const shortYearMatch = trimmed.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2})$/);
        if (shortYearMatch) {
          const [, first, second, shortYear] = shortYearMatch;
          const year = parseInt(shortYear) > 50 ? `19${shortYear}` : `20${shortYear}`;
          if (parseInt(first) <= 12) {
            return `${year}-${first.padStart(2, '0')}-${second.padStart(2, '0')}`;
          } else {
            return `${year}-${second.padStart(2, '0')}-${first.padStart(2, '0')}`;
          }
        }
        
        const monthNames: { [key: string]: string } = {
          'jan': '01', 'january': '01', 'feb': '02', 'february': '02',
          'mar': '03', 'march': '03', 'apr': '04', 'april': '04',
          'may': '05', 'jun': '06', 'june': '06', 'jul': '07', 'july': '07',
          'aug': '08', 'august': '08', 'sep': '09', 'september': '09',
          'oct': '10', 'october': '10', 'nov': '11', 'november': '11',
          'dec': '12', 'december': '12',
        };
        
        const textMonthMatch1 = trimmed.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})/i);
        if (textMonthMatch1) {
          const [, monthStr, day, year] = textMonthMatch1;
          const month = monthNames[monthStr.toLowerCase()];
          if (month) {
            return `${year}-${month}-${day.padStart(2, '0')}`;
          }
        }
        
        const textMonthMatch2 = trimmed.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/i);
        if (textMonthMatch2) {
          const [, day, monthStr, year] = textMonthMatch2;
          const month = monthNames[monthStr.toLowerCase()];
          if (month) {
            return `${year}-${month}-${day.padStart(2, '0')}`;
          }
        }
        
        const compactMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
        if (compactMatch) {
          const [, year, month, day] = compactMatch;
          return `${year}-${month}-${day}`;
        }
        
        const dateTimeMatch = trimmed.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})[T\s]/);
        if (dateTimeMatch) {
          const [, year, month, day] = dateTimeMatch;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        
        const parsedDate = new Date(trimmed);
        if (!isNaN(parsedDate.getTime())) {
          const year = parsedDate.getUTCFullYear();
          const month = String(parsedDate.getUTCMonth() + 1).padStart(2, '0');
          const day = String(parsedDate.getUTCDate()).padStart(2, '0');
          if (year >= 1900 && year <= 2100) {
            return `${year}-${month}-${day}`;
          }
        }
      }
      
      return null;
    }

    function getQuarter(month: number | null): string | null {
      if (!month) return null;
      if (month >= 1 && month <= 3) return 'Q1';
      if (month >= 4 && month <= 6) return 'Q2';
      if (month >= 7 && month <= 9) return 'Q3';
      if (month >= 10 && month <= 12) return 'Q4';
      return null;
    }

    function getMonth(dateStr: string | null): number | null {
      if (!dateStr) return null;
      const parts = dateStr.split('-');
      if (parts.length >= 2) {
        const month = parseInt(parts[1]);
        return isNaN(month) ? null : month;
      }
      return null;
    }

    function getYear(dateStr: string | null): number | null {
      if (!dateStr) return null;
      const parts = dateStr.split('-');
      if (parts.length >= 1) {
        const year = parseInt(parts[0]);
        return isNaN(year) ? null : year;
      }
      return null;
    }

    function parseNumeric(value: any): number | null {
      if (value === undefined || value === null || value === '') {
        return null;
      }
      
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
      
      const num = typeof value === 'number' ? value : Number(value);
      return isNaN(num) ? null : num;
    }

    function calculateChannel(entity: string, group: string | null, invoiceAccount: string | null): string | null {
      if (!entity) return null;
      
      const entityUpper = entity.toUpperCase();
      const groupStr = group?.toString().trim() || '';
      const invoiceAccountStr = invoiceAccount?.toString().trim() || '';

      // 이 엔티티들은 group 값을 그대로 channel로 사용, group이 공란이면 'Direct'
      if (['OCEANIA', 'INDIA', 'JAPAN', 'MEXICO', 'NETHERLANDS', 'GERMANY', 'UK', 'ASIA', 'EUROPE', 'SINGAPORE', 'SAMHAN', 'CHINA'].includes(entityUpper)) {
        return groupStr || 'Direct';
      }

      if (!groupStr) return null;

      if (entityUpper === 'CHINA') {
        if (groupStr === 'CG12' || groupStr === 'Direct') {
          return 'Direct';
        } else if (groupStr === 'CG22') {
          return 'Inter-Company';
        }
        return groupStr || null;
      }

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

    const isJapanEntity = entity === 'Japan';
    let filteredJsonData = jsonData;
    
    if (isJapanEntity && Object.keys(columnMap).length > 0) {
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

    const transformedData = filteredJsonData.map((row: any, index: number) => {
      const transformed: any = {
        entity: entity,
        upload_batch_id: batchId,
      };

      for (const [excelCol, dbCol] of Object.entries(columnMap)) {
        const value = row[excelCol];
        
        if (dbCol === 'invoice_date' || dbCol === 'due_date' || dbCol === 'created_date') {
          const parsedDate = parseDate(value);
          transformed[dbCol] = parsedDate;
          
          if (index < 3 && dbCol === 'invoice_date') {
            console.log(`📅 Row ${index + 1} date parsing:`, {
              excelCol,
              rawValue: value,
              rawType: typeof value,
              isDate: value instanceof Date,
              parsedDate,
            });
          }
          
          if (dbCol === 'invoice_date' && parsedDate) {
            transformed.year = getYear(parsedDate);
            transformed.month = getMonth(parsedDate);
            transformed.quarter = getQuarter(transformed.month);
          }
        } else if (numericColumns.includes(dbCol)) {
          const numValue = parseNumeric(value);
          if (numValue !== null) {
            transformed[dbCol] = numValue;
          }
        } else if (value !== undefined && value !== null && value !== '') {
          // 이미 값이 있으면 덮어쓰지 않음 (특히 invoice_date의 경우 'Invoice date'가 'Date'보다 우선)
          if (transformed[dbCol] === undefined || transformed[dbCol] === null) {
            transformed[dbCol] = value;
          }
        }
      }

      if (!transformed.industry || transformed.industry === null || transformed.industry === '') {
        transformed.industry = 'Other';
      }

      const channel = calculateChannel(
        entity,
        transformed.group || null,
        transformed.invoice_account || null
      );
      
      const entitiesUsingGroupAsChannel = ['Japan', 'Oceania', 'India', 'Mexico', 'Netherlands', 'Germany', 'UK', 'Asia', 'Europe', 'Singapore', 'Samhan', 'China'];
      if (entitiesUsingGroupAsChannel.includes(entity)) {
        // 이 엔티티들은 group 값을 그대로 channel로 사용, group이 공란이면 'Direct'
        const groupStr = transformed.group?.toString().trim() || '';
        transformed.channel = groupStr || 'Direct';
      } else if (channel) {
        transformed.channel = channel;
      }
      
      if (entity === 'Japan' && index < 3) {
        console.log(`🇯🇵 Japan row ${index + 1} channel calculation:`, {
          group: transformed.group,
          calculatedChannel: channel,
          finalChannel: transformed.channel,
        });
      }

      if (requiresItemMapping && transformed.item_number) {
        const normalizedItemNumber = transformed.item_number.toString().trim();
        if (normalizedItemNumber) {
          const itemMapping = itemMappingMap.get(normalizedItemNumber);
          if (itemMapping) {
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
          }
        }
      }

      // FREETEXT 자동 채우기 로직: HQ, Healthcare, Korot에서 sales_type이 "FREETEXT"이고 item_number가 공란인 경우
      const entitiesForFreeText = ['HQ', 'Healthcare', 'Korot'];
      if (entitiesForFreeText.includes(entity)) {
        const salesType = transformed.sales_type?.toString().trim().toUpperCase();
        const itemNumber = transformed.item_number?.toString().trim() || '';
        
        if (salesType === 'FREETEXT' && !itemNumber) {
          // 기존 값이 없을 때만 자동으로 채움
          if (!transformed.category || transformed.category === '') {
            transformed.category = 'Others';
          }
          if (!transformed.model || transformed.model === '') {
            transformed.model = 'OTH_ETC';
          }
          if (!transformed.fg_classification || transformed.fg_classification === '') {
            transformed.fg_classification = 'NonFG';
          }
          if (!transformed.product || transformed.product === '') {
            transformed.product = 'ETC';
          }
          
          if (index < 3) {
            console.log(`✅ [${entity}] FREETEXT 자동 채우기 적용 (row ${index + 1}):`, {
              sales_type: transformed.sales_type,
              item_number: transformed.item_number,
              category: transformed.category,
              model: transformed.model,
              fg_classification: transformed.fg_classification,
              product: transformed.product,
            });
          }
        }
      }

      return transformed;
    });

    if (transformedData.length > 0) {
      console.log('📊 Transformed data sample (first row):', {
        entity: transformedData[0].entity,
        year: transformedData[0].year,
        month: transformedData[0].month,
        quarter: transformedData[0].quarter,
        invoice_date: transformedData[0].invoice_date,
        group: transformedData[0].group,
        channel: transformedData[0].channel,
      });
    }

    // ============================================
    // 🔑 행 단위 중복 검증 로직 (모든 Entity 공통)
    // 각 row를 (invoice, line_number) 기준으로 DB와 1:1 비교
    // line_number가 없는 경우 (invoice, item_number, line_amount_mst) 사용
    // → 중복인 행만 스킵, 새로운 행은 업로드
    // ============================================
    console.log(`🔍 [${entity}] Row-level duplicate check: (invoice, line_number) per row`);

    const originalCount = transformedData.length;
    let deduplicatedData: any[] = [];

    // Step A: 업로드 파일에서 invoice 목록 수집
    const invoiceSet = new Set<string>();
    transformedData.forEach((row) => {
      const inv = (row.invoice || '').toString().trim();
      if (inv) invoiceSet.add(inv);
    });
    const invoiceList = [...invoiceSet];
    console.log(`📋 [${entity}] Upload has ${transformedData.length} rows across ${invoiceList.length} unique invoices`);

    // Step B: DB에서 동일 invoice의 기존 행 조회 → 행 단위 키 Set 생성
    const dbExistingKeys = new Set<string>();

    if (invoiceList.length > 0) {
      const DB_BATCH_SIZE = 1000;
      let totalDbRows = 0;

      for (let i = 0; i < invoiceList.length; i += DB_BATCH_SIZE) {
        const batchInvoices = invoiceList.slice(i, i + DB_BATCH_SIZE);
        const batchNum = Math.floor(i / DB_BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(invoiceList.length / DB_BATCH_SIZE);
        console.log(`🔍 [${entity}] Querying DB batch ${batchNum}/${totalBatches} (${batchInvoices.length} invoices)...`);

        const { data: dbRows, error: dbError } = await supabase
          .from('sales_data')
          .select('invoice, line_number, item_number, line_amount_mst')
          .eq('entity', entity)
          .in('invoice', batchInvoices);

        if (dbError) {
          console.error(`❌ [${entity}] DB query failed (batch ${batchNum}):`, dbError.message);
        } else if (dbRows && dbRows.length > 0) {
          totalDbRows += dbRows.length;
          dbRows.forEach((row: any) => {
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
          console.log(`📊 [${entity}] Batch ${batchNum}: Found ${dbRows.length} existing DB rows`);
        }
      }
      console.log(`📊 [${entity}] Total DB existing keys: ${dbExistingKeys.size} (from ${totalDbRows} rows)`);
    } else {
      console.log(`✅ [${entity}] No invoices to check → all rows are new`);
    }

    // Step C: 각 업로드 행을 DB 키와 비교 → 새 행만 허용
    let duplicateRowCount = 0;
    const allowedRows: any[] = [];

    transformedData.forEach((row) => {
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

    if (duplicateRowCount > 0) {
      console.log(`🚫 [${entity}] Skipped ${duplicateRowCount} duplicate rows → ${allowedRows.length} new rows will be inserted`);
    } else {
      console.log(`✅ [${entity}] No duplicate rows found → all ${allowedRows.length} rows will be inserted`);
    }

    deduplicatedData = allowedRows;

    // 최종 통계
    const totalDuplicatesRemoved = originalCount - deduplicatedData.length;
    if (totalDuplicatesRemoved > 0) {
      console.log(`📊 [${entity}] Duplicate removal summary: ${totalDuplicatesRemoved} rows blocked (${deduplicatedData.length} rows to insert)`);
    }

    // deduplicatedData를 transformedData로 교체
    transformedData.length = 0;
    transformedData.push(...deduplicatedData);

    // 9. Insert data in batches
    const BATCH_SIZE = 250;
    let totalInserted = 0;
    let totalSkipped = 0;
    const errors: any[] = [];
    const startTime = Date.now();
    const MAX_PROCESSING_TIME = 240 * 1000;

    const checkTimeout = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_PROCESSING_TIME) {
        console.warn(`⏱️ Processing time exceeded ${MAX_PROCESSING_TIME / 1000}s, but continuing...`);
      }
    };

    const insertBatchRecursive = async (batch: any[], minSize: number = 10): Promise<{ inserted: number; skipped: number }> => {
      checkTimeout();

      if (batch.length <= minSize) {
        let inserted = 0;
        let skipped = 0;

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

      try {
        const { data, error } = await supabase
          .from('sales_data')
          .insert(batch)
          .select();

        if (error) {
          if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
            console.log(`⚠️ Duplicate error in batch of ${batch.length} records.`);
            
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
          return {
            inserted: data?.length || batch.length,
            skipped: 0,
          };
        }
      } catch (batchError) {
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
        
        if (i + BATCH_SIZE < transformedData.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } catch (error) {
        console.error(`❌ Batch ${batchNumber} error:`, error);
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

    // 11. Refresh materialized view (mv_sales_cube) for dashboard
    try {
      console.log('🔄 Refreshing mv_sales_cube materialized view...');
      const refreshRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/dashboard/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        console.log('✅ Materialized view refreshed successfully:', refreshData.message);
      } else {
        const refreshError = await refreshRes.json();
        console.warn('⚠️ Failed to refresh materialized view:', refreshError.details || refreshError.error);
        console.warn('⚠️ Note: Dashboard may not show the latest data until mv_sales_cube is refreshed manually.');
      }
    } catch (refreshError) {
      console.warn('⚠️ Error refreshing materialized view:', refreshError);
      console.warn('⚠️ Note: Dashboard may not show the latest data until mv_sales_cube is refreshed manually.');
    }

    return NextResponse.json({
      success: true,
      rowsInserted: totalInserted,
      rowsSkipped: totalSkipped,
      duplicateRowsSkipped: duplicateRowCount,
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

// Default column mapping
function getDefaultColumnMapping(): { [key: string]: string } {
  return {
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
    'Customer Group': 'group',
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
