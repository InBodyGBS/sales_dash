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
    const entitiesRequiringItemMapping = ['Japan', 'China', 'India', 'Mexico', 'Oceania', 'Netherlands', 'Germany', 'UK', 'Asia', 'Europe', 'Singapore'];
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
    // cellDates: true 옵션으로 날짜를 Date 객체로 파싱
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    // raw: true로 원본 값 유지, defval로 빈 셀 처리
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: null });

    console.log(`📊 Parsed ${jsonData.length} rows from Excel`);

    // 첫 번째 행의 날짜 컬럼 값 디버깅
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
    // 개선된 parseDate 함수 - 다양한 날짜 형식 지원
    // ============================================
    function parseDate(value: any): string | null {
      if (!value) return null;
      
      // 1. Date 객체 (엑셀에서 cellDates: true로 읽은 경우)
      if (value instanceof Date && !isNaN(value.getTime())) {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        if (year >= 1900 && year <= 2100) {
          return `${year}-${month}-${day}`;
        }
      }
      
      // 2. 엑셀 숫자 형식 (Serial Date Number)
      if (typeof value === 'number') {
        // 엑셀 시리얼 넘버 범위 체크 (1900-01-01 ~ 2100-12-31)
        if (value > 0 && value < 100000) {
          const date = XLSX.SSF.parse_date_code(value);
          if (date) {
            return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
          }
        }
      }
      
      // 3. 문자열 형식
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        
        // 3-1. ISO 형식: 2025-01-15, 2025/01/15
        const isoMatch = trimmed.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
        if (isoMatch) {
          const [, year, month, day] = isoMatch;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        
        // 3-2. 미국 형식: 01/15/2025, 01-15-2025, 1/15/2025
        const usMatch = trimmed.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
        if (usMatch) {
          const [, month, day, year] = usMatch;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        
        // 3-3. 유럽 형식: 15.01.2025
        const euDotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (euDotMatch) {
          const [, day, month, year] = euDotMatch;
          if (parseInt(month) <= 12) {
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
        }
        
        // 3-4. 짧은 연도 형식: 01/15/25, 15/01/25
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
        
        // 3-5. 텍스트 월 형식: Jan 15, 2025 / 15 Jan 2025 / January 15, 2025
        const monthNames: { [key: string]: string } = {
          'jan': '01', 'january': '01',
          'feb': '02', 'february': '02',
          'mar': '03', 'march': '03',
          'apr': '04', 'april': '04',
          'may': '05',
          'jun': '06', 'june': '06',
          'jul': '07', 'july': '07',
          'aug': '08', 'august': '08',
          'sep': '09', 'september': '09',
          'oct': '10', 'october': '10',
          'nov': '11', 'november': '11',
          'dec': '12', 'december': '12',
        };
        
        // Jan 15, 2025 또는 January 15, 2025
        const textMonthMatch1 = trimmed.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})/i);
        if (textMonthMatch1) {
          const [, monthStr, day, year] = textMonthMatch1;
          const month = monthNames[monthStr.toLowerCase()];
          if (month) {
            return `${year}-${month}-${day.padStart(2, '0')}`;
          }
        }
        
        // 15 Jan 2025 또는 15 January 2025
        const textMonthMatch2 = trimmed.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/i);
        if (textMonthMatch2) {
          const [, day, monthStr, year] = textMonthMatch2;
          const month = monthNames[monthStr.toLowerCase()];
          if (month) {
            return `${year}-${month}-${day.padStart(2, '0')}`;
          }
        }
        
        // 3-6. YYYYMMDD 형식: 20250115
        const compactMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
        if (compactMatch) {
          const [, year, month, day] = compactMatch;
          return `${year}-${month}-${day}`;
        }
        
        // 3-7. 날짜+시간 형식: 2025-01-15T10:30:00, 2025-01-15 10:30:00
        const dateTimeMatch = trimmed.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})[T\s]/);
        if (dateTimeMatch) {
          const [, year, month, day] = dateTimeMatch;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        
        // 3-8. JavaScript Date 객체로 파싱 시도 (마지막 수단)
        const parsedDate = new Date(trimmed);
        if (!isNaN(parsedDate.getTime())) {
          const year = parsedDate.getFullYear();
          const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
          const day = String(parsedDate.getDate()).padStart(2, '0');
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

      // 이 엔티티들은 group 값을 그대로 channel로 사용 (group이 비어있어도 체크)
      // Japan, Oceania, India, Mexico, Netherlands, Germany, UK, Asia, Europe, Singapore
      if (['OCEANIA', 'INDIA', 'JAPAN', 'MEXICO', 'NETHERLANDS', 'GERMANY', 'UK', 'ASIA', 'EUROPE', 'SINGAPORE'].includes(entityUpper)) {
        // group이 있으면 그대로 channel로 사용, 없으면 null
        return groupStr || null;
      }

      // group이 비어있으면 null 반환 (위 엔티티들 제외)
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

      // 먼저 모든 컬럼 매핑 처리
      for (const [excelCol, dbCol] of Object.entries(columnMap)) {
        const value = row[excelCol];
        
        if (dbCol === 'invoice_date' || dbCol === 'due_date' || dbCol === 'created_date') {
          const parsedDate = parseDate(value);
          transformed[dbCol] = parsedDate;
          
          // 디버깅: 처음 3행의 날짜 파싱 결과 로깅
          if (index < 3 && dbCol === 'invoice_date') {
            console.log(`📅 Row ${index + 1} date parsing:`, {
              excelCol,
              rawValue: value,
              rawType: typeof value,
              isDate: value instanceof Date,
              parsedDate,
            });
          }
          
          // invoice_date에서 year, month, quarter 추출
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
          transformed[dbCol] = value;
        }
      }

      // Industry가 NULL이면 'Other'로 설정
      if (!transformed.industry || transformed.industry === null || transformed.industry === '') {
        transformed.industry = 'Other';
      }

      // Channel 계산 - group 값이 있으면 항상 계산
      // Japan, Oceania, India, Mexico, Netherlands, Germany, UK, Asia, Europe, Singapore의 경우
      // group 값이 있으면 무조건 channel로 설정
      const channel = calculateChannel(
        entity,
        transformed.group || null,
        transformed.invoice_account || null
      );
      
      // Japan 등 특정 entity는 group이 있으면 channel로 설정 (null이어도 명시적으로 설정)
      const entitiesUsingGroupAsChannel = ['Japan', 'Oceania', 'India', 'Mexico', 'Netherlands', 'Germany', 'UK', 'Asia', 'Europe', 'Singapore'];
      if (entitiesUsingGroupAsChannel.includes(entity) && transformed.group) {
        transformed.channel = transformed.group.toString().trim() || channel || null;
      } else if (channel) {
        transformed.channel = channel;
      }
      
      // 디버깅: Japan의 경우 group과 channel 로깅
      if (entity === 'Japan' && index < 3) {
        console.log(`🇯🇵 Japan row ${index + 1} channel calculation:`, {
          group: transformed.group,
          calculatedChannel: channel,
          finalChannel: transformed.channel,
        });
      }

      // Item Mapping 적용
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

      return transformed;
    });

    // 변환된 데이터 샘플 로깅
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

    // 8.5. 중복 검증 (entity 그룹별로 다른 로직 적용)
    // 그룹 1: HQ, Korot, Healthcare, USA, BWA, Vietnam → 기존 키 기반 중복 제거
    // 그룹 2: 나머지 entity (Japan, China, India, Mexico, ...) → invoice + customer_invoice_account + 합계 기반 중복 차단
    const GROUP1_ENTITIES = ['HQ', 'Korot', 'Healthcare', 'USA', 'BWA', 'Vietnam'];
    const isGroup1 = GROUP1_ENTITIES.includes(entity);

    console.log(`🔍 [${entity}] Duplicate check mode: ${isGroup1 ? 'GROUP1 (key-based)' : 'GROUP2 (invoice+amount-based)'}`);
    const originalCount = transformedData.length;
    let deduplicatedData: any[] = [...transformedData];

    if (isGroup1) {
      // ─────────────────────────────────────────────────────────────
      // 그룹 1: entity + invoice + invoice_date + item_number + line_number 키 기반 중복 제거
      // ─────────────────────────────────────────────────────────────
      
      // 날짜 정규화 함수 (키 생성 시 사용)
      function normalizeDateForKey(dateValue: any): string {
        if (!dateValue) return 'NULL';
        
        // 이미 YYYY-MM-DD 형식인 경우
        if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
          return dateValue;
        }
        
        // Date 객체인 경우
        if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
          const year = dateValue.getFullYear();
          const month = String(dateValue.getMonth() + 1).padStart(2, '0');
          const day = String(dateValue.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        
        // 문자열인 경우 parseDate 사용
        if (typeof dateValue === 'string') {
          const normalized = parseDate(dateValue);
          return normalized || 'NULL';
        }
        
        // 기타 경우 문자열로 변환 후 parseDate 시도
        const normalized = parseDate(String(dateValue));
        return normalized || 'NULL';
      }

      // Step 1: 파일 내 중복 제거
      const uniqueMap = new Map<string, any>();
      let duplicateCount = 0;

      transformedData.forEach((row) => {
        const lineNumber = row.line_number !== null && row.line_number !== undefined
          ? String(row.line_number)
          : 'NULL';
        const normalizedDate = normalizeDateForKey(row.invoice_date);
        const key = `${row.entity}|${row.invoice || 'NULL'}|${normalizedDate}|${row.item_number || 'NULL'}|${lineNumber}`;

        if (uniqueMap.has(key)) {
          duplicateCount++;
          if (duplicateCount <= 5) {
            console.warn(`⚠️ [${entity}] Duplicate in file: ${key}`);
          }
        } else {
          uniqueMap.set(key, row);
        }
      });

      let fileDeduplicatedData = Array.from(uniqueMap.values());
      const fileDuplicatesRemoved = originalCount - fileDeduplicatedData.length;

      if (fileDuplicatesRemoved > 0) {
        console.log(`🗑️ [${entity}] Removed ${fileDuplicatesRemoved} duplicate rows from file (${fileDeduplicatedData.length} unique rows remaining)`);
        if (duplicateCount > 5) {
          console.log(`   ... and ${duplicateCount - 5} more duplicates`);
        }
      } else {
        console.log(`✅ [${entity}] No duplicates found in file`);
      }

      // Step 2: 업로드 파일과 DB에 이미 존재하는 데이터 비교 (중복 체크)
      console.log(`🔍 [${entity}] Checking for duplicates: comparing upload file with existing DB data...`);
      const dbDuplicateKeys = new Set<string>();

      if (fileDeduplicatedData.length > 0) {
        // 업로드할 데이터의 고유 키 목록 생성
        const uploadKeys = fileDeduplicatedData.map((row) => {
          const lineNumber = row.line_number !== null && row.line_number !== undefined
            ? String(row.line_number)
            : 'NULL';
          const normalizedDate = normalizeDateForKey(row.invoice_date);
          return {
            key: `${row.entity}|${row.invoice || 'NULL'}|${normalizedDate}|${row.item_number || 'NULL'}|${lineNumber}`,
            invoice: row.invoice || null,
            invoice_date: row.invoice_date || null,
            item_number: row.item_number || null,
            line_number: row.line_number,
          };
        });

        console.log(`📋 [${entity}] Upload file has ${uploadKeys.length} rows to check against DB`);
        
        // 샘플 키 출력 (디버깅용)
        if (uploadKeys.length > 0) {
          console.log(`📋 [${entity}] Sample upload keys (first 3):`, uploadKeys.slice(0, 3).map(k => k.key));
        }

        // invoice 목록 추출 (null 제외)
        const invoiceList = [...new Set(uploadKeys.map((k) => k.invoice).filter(Boolean))];
        console.log(`📋 [${entity}] Checking ${invoiceList.length} unique invoices in DB:`, invoiceList.slice(0, 5), invoiceList.length > 5 ? `... and ${invoiceList.length - 5} more` : '');

        if (invoiceList.length > 0) {
          // DB에서 동일 entity의 invoice 목록에 해당하는 데이터 조회
          // Supabase의 .in() 제한을 고려하여 배치로 처리 (최대 1000개씩)
          const BATCH_SIZE = 1000;
          let allDbRows: any[] = [];
          
          for (let i = 0; i < invoiceList.length; i += BATCH_SIZE) {
            const batchInvoices = invoiceList.slice(i, i + BATCH_SIZE);
            console.log(`🔍 [${entity}] Querying DB batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(invoiceList.length / BATCH_SIZE)} (${batchInvoices.length} invoices)...`);
            
            const { data: dbRows, error: dbError } = await supabase
              .from('sales_data')
              .select('invoice, invoice_date, item_number, line_number')
              .eq('entity', entity)
              .in('invoice', batchInvoices);

            if (dbError) {
              console.error(`❌ [${entity}] DB duplicate check query failed (batch ${Math.floor(i / BATCH_SIZE) + 1}):`, dbError.message);
              console.error(`   Query: entity='${entity}', invoices=[${batchInvoices.slice(0, 3).join(', ')}...]`);
              // DB 조회 실패 시 중복 체크 없이 진행
            } else if (dbRows && dbRows.length > 0) {
              allDbRows.push(...dbRows);
              console.log(`📊 [${entity}] Batch ${Math.floor(i / BATCH_SIZE) + 1}: Found ${dbRows.length} existing DB rows`);
            }
          }

          if (allDbRows.length > 0) {
            console.log(`📊 [${entity}] Total: Found ${allDbRows.length} existing DB rows for ${invoiceList.length} invoices`);

            // DB 행의 키 생성 및 Set에 추가 (날짜 정규화 적용)
            let keyGenerationErrors = 0;
            allDbRows.forEach((row: any, idx: number) => {
              try {
                const lineNumber = row.line_number !== null && row.line_number !== undefined
                  ? String(row.line_number)
                  : 'NULL';
                const normalizedDate = normalizeDateForKey(row.invoice_date);
                const dbKey = `${entity}|${row.invoice || 'NULL'}|${normalizedDate}|${row.item_number || 'NULL'}|${lineNumber}`;
                dbDuplicateKeys.add(dbKey);
                
                // 처음 3개 키 샘플 출력
                if (idx < 3) {
                  console.log(`   DB key ${idx + 1}: ${dbKey} (raw invoice_date: ${row.invoice_date}, normalized: ${normalizedDate})`);
                }
              } catch (keyError) {
                keyGenerationErrors++;
                if (keyGenerationErrors <= 3) {
                  console.warn(`⚠️ [${entity}] Error generating key for DB row:`, row, keyError);
                }
              }
            });

            if (keyGenerationErrors > 0) {
              console.warn(`⚠️ [${entity}] ${keyGenerationErrors} errors occurred while generating keys from DB rows`);
            }

            console.log(`🔍 [${entity}] Generated ${dbDuplicateKeys.size} unique keys from ${allDbRows.length} DB rows`);
            console.log(`   Sample DB keys (first 3):`, Array.from(dbDuplicateKeys).slice(0, 3));
          } else {
            console.log(`✅ [${entity}] No existing DB rows found for these invoices → no duplicates`);
          }
        } else {
          console.warn(`⚠️ [${entity}] No valid invoices found in upload file → skipping DB duplicate check`);
        }
      }

      // Step 3: 업로드 파일의 각 행을 DB 키와 비교하여 중복 제외
      const finalData: any[] = [];
      let dbDuplicateCount = 0;
      const duplicateSamples: string[] = [];

      console.log(`🔍 [${entity}] Comparing ${fileDeduplicatedData.length} upload rows against ${dbDuplicateKeys.size} DB keys...`);

      fileDeduplicatedData.forEach((row, index) => {
        const lineNumber = row.line_number !== null && row.line_number !== undefined
          ? String(row.line_number)
          : 'NULL';
        const normalizedDate = normalizeDateForKey(row.invoice_date);
        const uploadKey = `${row.entity}|${row.invoice || 'NULL'}|${normalizedDate}|${row.item_number || 'NULL'}|${lineNumber}`;

        if (dbDuplicateKeys.has(uploadKey)) {
          dbDuplicateCount++;
          if (dbDuplicateCount <= 10) {
            duplicateSamples.push(`Row ${index + 1}: ${uploadKey} (raw invoice_date: ${row.invoice_date}, normalized: ${normalizedDate})`);
            console.warn(`🚫 [${entity}] Duplicate found (upload file row ${index + 1} matches DB): ${uploadKey}`);
          }
        } else {
          finalData.push(row);
        }
      });

      if (dbDuplicateCount > 0) {
        console.log(`🚫 [${entity}] Skipped ${dbDuplicateCount} duplicate rows from DB (${finalData.length} rows will be inserted)`);
        if (duplicateSamples.length > 0) {
          console.log(`   Duplicate samples (first ${Math.min(10, duplicateSamples.length)}):`);
          duplicateSamples.forEach(sample => console.log(`     - ${sample}`));
        }
        if (dbDuplicateCount > 10) {
          console.log(`   ... and ${dbDuplicateCount - 10} more duplicates`);
        }
      } else {
        console.log(`✅ [${entity}] No duplicates found in DB → all ${fileDeduplicatedData.length} rows will be inserted`);
        
        // 디버깅: 왜 중복이 감지되지 않는지 확인
        if (dbDuplicateKeys.size > 0 && fileDeduplicatedData.length > 0) {
          console.log(`🔍 [${entity}] Debug: Checking why duplicates weren't detected...`);
          const sampleUploadKey = fileDeduplicatedData[0];
          const sampleKey = `${sampleUploadKey.entity}|${sampleUploadKey.invoice || 'NULL'}|${normalizeDateForKey(sampleUploadKey.invoice_date)}|${sampleUploadKey.item_number || 'NULL'}|${sampleUploadKey.line_number !== null && sampleUploadKey.line_number !== undefined ? String(sampleUploadKey.line_number) : 'NULL'}`;
          console.log(`   Sample upload key: ${sampleKey}`);
          console.log(`   Key exists in DB keys? ${dbDuplicateKeys.has(sampleKey)}`);
          if (!dbDuplicateKeys.has(sampleKey)) {
            const similarKeys = Array.from(dbDuplicateKeys).filter(k => 
              k.includes(sampleUploadKey.invoice || '') || 
              k.includes(sampleUploadKey.item_number || '')
            ).slice(0, 3);
            if (similarKeys.length > 0) {
              console.log(`   Similar DB keys found:`, similarKeys);
            }
          }
        }
      }

      deduplicatedData = finalData;

    } else {
      // ─────────────────────────────────────────────────────────────
      // 그룹 2: invoice + customer_invoice_account + line_amount_mst 합계 기반 중복 차단
      // ─────────────────────────────────────────────────────────────

      // Step A: 파일 내에서 (invoice, customer_invoice_account) 그룹별 합계 계산
      type InvoiceGroup = { invoice: string; customerInvoiceAccount: string; sum: number; rows: any[] };
      const uploadGroupMap = new Map<string, InvoiceGroup>();

      transformedData.forEach((row) => {
        const inv = (row.invoice || '').toString().trim();
        const acc = (row.customer_invoice_account || '').toString().trim();
        const key = `${inv}|${acc}`;
        const amount = parseFloat(row.line_amount_mst) || 0;

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
      console.log(`📋 [${entity}] Checking ${invoiceList.length} unique invoices in DB for Group 2 duplicate check`);

      let dbGroupSums = new Map<string, number>(); // key: `invoice|account` → sum
      if (invoiceList.length > 0) {
        // Supabase의 .in() 제한을 고려하여 배치로 처리 (최대 1000개씩)
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
            // DB 조회 실패 시 중복 차단 없이 진행
          } else if (dbRows && dbRows.length > 0) {
            allDbRows.push(...dbRows);
            console.log(`📊 [${entity}] Batch ${Math.floor(i / BATCH_SIZE) + 1}: Found ${dbRows.length} existing DB rows`);
          }
        }

        if (allDbRows.length > 0) {
          console.log(`📊 [${entity}] Total: Found ${allDbRows.length} existing DB rows for ${invoiceList.length} invoices`);

          // DB 행을 (invoice, customer_invoice_account) 그룹별로 합계 집계
          allDbRows.forEach((row: any, idx: number) => {
            const inv = (row.invoice || '').toString().trim();
            const acc = (row.customer_invoice_account || '').toString().trim();
            const key = `${inv}|${acc}`;
            const amount = parseFloat(row.line_amount_mst) || 0;
            dbGroupSums.set(key, (dbGroupSums.get(key) || 0) + amount);
            
            // 처음 3개 샘플 출력
            if (idx < 3) {
              console.log(`   DB row ${idx + 1}: invoice=${inv}, account=${acc}, amount=${amount}, key=${key}`);
            }
          });
          
          console.log(`📊 [${entity}] Aggregated ${dbGroupSums.size} unique (invoice, account) groups from DB`);
        } else {
          console.log(`✅ [${entity}] No existing DB rows found for uploaded invoices → no duplicates`);
        }
      }

      // Step C: 합계 비교 → 중복 그룹만 제외하고 나머지는 업로드
      const blockedGroups: string[] = [];
      const allowedRows: any[] = [];
      let duplicateGroupCount = 0;

      uploadGroups.forEach((group, idx) => {
        const key = `${group.invoice}|${group.customerInvoiceAccount}`;
        const dbSum = dbGroupSums.get(key) ?? null;

        if (dbSum !== null && Math.abs(group.sum - dbSum) < 0.01) {
          // 합계가 동일 → 중복으로 판단, 해당 그룹 제외
          duplicateGroupCount++;
          const groupInfo = `invoice=${group.invoice}, account=${group.customerInvoiceAccount}, uploadSum=${group.sum.toFixed(2)}, dbSum=${dbSum.toFixed(2)}, rows=${group.rows.length}`;
          blockedGroups.push(groupInfo);
          
          if (duplicateGroupCount <= 10) {
            console.warn(`🚫 [${entity}] Duplicate group ${duplicateGroupCount} (skipped): ${groupInfo}`);
          }
        } else {
          // 합계가 다르거나 DB에 없음 → 새 데이터로 허용
          if (dbSum !== null) {
            if (idx < 5) {
              console.log(`✅ [${entity}] New data (sum differs): invoice=${group.invoice} uploadSum=${group.sum.toFixed(2)} dbSum=${dbSum.toFixed(2)}`);
            }
          }
          allowedRows.push(...group.rows);
        }
      });

      if (blockedGroups.length > 0) {
        console.log(`🚫 [${entity}] Skipped ${blockedGroups.length} duplicate invoice group(s) (${allowedRows.length} rows will be inserted)`);
        if (blockedGroups.length > 0) {
          console.log(`   Blocked groups (first ${Math.min(10, blockedGroups.length)}):`);
          blockedGroups.slice(0, 10).forEach((bg, idx) => {
            console.log(`     ${idx + 1}. ${bg}`);
          });
        }
        if (blockedGroups.length > 10) {
          console.log(`   ... and ${blockedGroups.length - 10} more duplicate groups`);
        }
      } else {
        console.log(`✅ [${entity}] No duplicate invoice groups found → all ${allowedRows.length} rows will be inserted`);
        
        // 디버깅: 왜 중복이 감지되지 않는지 확인
        if (dbGroupSums.size > 0 && uploadGroups.length > 0) {
          console.log(`🔍 [${entity}] Debug: Checking why duplicates weren't detected...`);
          const sampleGroup = uploadGroups[0];
          const sampleKey = `${sampleGroup.invoice}|${sampleGroup.customerInvoiceAccount}`;
          const sampleDbSum = dbGroupSums.get(sampleKey);
          console.log(`   Sample upload group: invoice=${sampleGroup.invoice}, account=${sampleGroup.customerInvoiceAccount}, sum=${sampleGroup.sum.toFixed(2)}`);
          console.log(`   DB sum for this key: ${sampleDbSum !== undefined ? sampleDbSum.toFixed(2) : 'NOT FOUND'}`);
          if (sampleDbSum !== undefined) {
            console.log(`   Difference: ${Math.abs(sampleGroup.sum - sampleDbSum).toFixed(2)} (tolerance: 0.01)`);
          }
        }
      }

      deduplicatedData = allowedRows;
    }

    // 최종 통계
    const totalDuplicatesRemoved = originalCount - deduplicatedData.length;
    if (totalDuplicatesRemoved > 0) {
      console.log(`📊 [${entity}] Duplicate removal summary: ${totalDuplicatesRemoved} rows removed/blocked (${deduplicatedData.length} rows to insert)`);
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

    // 11. Refresh dashboard cache
    try {
      console.log('🔄 Refreshing dashboard cache...');
      const { error: refreshError } = await supabase.rpc('refresh_dashboard');
      if (refreshError) {
        console.warn('⚠️ Failed to refresh dashboard cache:', refreshError.message);
      } else {
        console.log('✅ Dashboard cache refreshed successfully');
      }
    } catch (refreshError) {
      console.warn('⚠️ Error refreshing dashboard cache:', refreshError);
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

// Default column mapping
function getDefaultColumnMapping(): { [key: string]: string } {
  return {
    'Sales Type': 'sales_type',
    'Invoice': 'invoice',
    'Voucher': 'voucher',
    'Invoice date': 'invoice_date',
    'Date': 'invoice_date',
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
