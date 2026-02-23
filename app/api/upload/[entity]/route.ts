// app/api/upload/[entity]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';

// Route Segment Config for large file uploads
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

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

export async function POST(
  request: NextRequest,
  { params }: { params: { entity: string } }
) {
  const entity = params.entity;
  let historyId: string | null = null;

  try {
    console.log(`📥 Upload request for entity: ${entity}`);

    // File is now uploaded directly from client to Supabase Storage
    // We only receive the storage path and file name
    const body = await request.json();
    const { storagePath, fileName } = body;

    if (!storagePath || !fileName) {
      return NextResponse.json(
        { error: 'Storage path and file name are required' },
        { status: 400 }
      );
    }

    console.log(`📄 File: ${fileName} at ${storagePath}`);

    const supabase = createServiceClient();

    // 1. 업로드 히스토리 생성
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

    if (historyError) throw historyError;
    historyId = history.id;

    console.log(`✅ Upload history created: ${historyId}`);

    // 2. 즉시 응답 반환 (타임아웃 방지)
    // 데이터 처리는 별도 API (/api/upload/process)에서 처리
    console.log(`📤 File already uploaded to storage. Processing will be done separately.`);

    // 3. 백그라운드에서 처리 시작 (비동기, 응답을 기다리지 않음)
    // 클라이언트에서 처리 API를 호출하도록 안내
    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully. Processing will start shortly.',
      data: {
        historyId,
        fileName: fileName,
        storagePath,
        status: 'processing',
        needsProcessing: true,
      },
    });

  } catch (error) {
    console.error('❌ Upload error:', error);

    // 에러 발생 시 히스토리 업데이트
    if (historyId) {
      const supabase = createServiceClient();
      await supabase
        .from('upload_history')
        .update({
          status: 'failed',
          error_message: (error as Error).message,
        })
        .eq('id', historyId);
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Upload failed',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
