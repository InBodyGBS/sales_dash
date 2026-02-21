import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const entity = formData.get('entity') as string;

    if (!file || !entity) {
      return NextResponse.json(
        { error: 'File and entity are required' },
        { status: 400 }
      );
    }

    console.log(`📁 Processing: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📊 Parsed ${data.length} rows`);

    if (data.length === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // ============================================
    // 🔑 통합 중복 검증 로직 (모든 Entity 공통)
    // entity + invoice + customer_invoice_account 그룹의 line_amount_mst 합계 비교
    // ============================================
    console.log(`🔍 [${entity}] Unified duplicate check: entity + invoice + customer_invoice_account → SUM(line_amount_mst)`);
    
    // Step A: 파일 내에서 (invoice, customer_invoice_account) 그룹별 합계 계산
    type InvoiceGroup = { invoice: string; customerInvoiceAccount: string; sum: number; rows: any[] };
    const uploadGroupMap = new Map<string, InvoiceGroup>();

    (data as any[]).forEach((row) => {
      const inv = (row['Invoice'] || '').toString().trim();
      const acc = (row['Customer Invoice Account'] || '').toString().trim();
      const key = `${inv}|${acc}`;
      const amount = parseNumber(row['Line Amount MST']);

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
    const processedData = allowedRows;

    let insertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // 🔥 배치 처리 + 에러 캐치
    const BATCH_SIZE = 100;
    
    for (let i = 0; i < processedData.length; i += BATCH_SIZE) {
      const batch = processedData.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      
      console.log(`⚙️  Batch ${batchNumber}: ${batch.length} rows`);

      // 배치를 하나씩 INSERT 시도
      for (let j = 0; j < batch.length; j++) {
        const row: any = batch[j];
        const rowNumber = i + j + 2;  // Excel row number

        try {
          const record: any = {
            entity: entity,
            year: parseYear(row['Invoice Date']),
            quarter: parseQuarter(row['Invoice Date']),
            month: parseMonth(row['Invoice Date']),
            invoice_date: parseDate(row['Invoice Date']),
            invoice: row['Invoice']?.toString() || null,
            sales_order: row['Sales Order']?.toString() || null,
            item_number: row['Item Number']?.toString() || null,
            line_number: parseNumber(row['Line Number']),
            quantity: parseNumber(row['Quantity']),
            line_amount_mst: parseNumber(row['Line Amount MST']),
            invoice_amount: parseNumber(row['Invoice Amount']),
            customer_invoice_account: row['Customer Invoice Account']?.toString() || null,
            currency: row['Currency']?.toString() || null,
            industry: row['Industry']?.toString() || null,
            sales_channel: row['Sales Channel']?.toString() || null,
            country: row['Country']?.toString() || null,
            created_at: new Date().toISOString(),
          };

          // 행 해시 생성 (중복 체크용)
          record.row_hash = generateRowHash(record);

          if (!record.invoice || !record.item_number) {
            skippedCount++;
            continue;
          }

          const { error } = await supabase
            .from('sales_data')
            .insert([record]);

          if (error) {
            if (error.code === '23505') {  // 중복 에러 (unique constraint violation)
              skippedCount++;
            } else {
              errorCount++;
              if (errors.length < 10) {
                errors.push(`Row ${rowNumber}: ${error.message}`);
              }
            }
          } else {
            insertedCount++;
          }

        } catch (error) {
          errorCount++;
          if (errors.length < 10) {
            errors.push(`Row ${rowNumber}: ${(error as Error).message}`);
          }
        }
      }

      console.log(`✅ Batch ${batchNumber} done: ${insertedCount} total inserted, ${skippedCount} total skipped`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`🎉 Upload completed in ${duration}s`);

    return NextResponse.json({
      success: true,
      message: `✅ ${insertedCount} inserted, ⚠️ ${skippedCount} duplicates skipped`,
      stats: {
        totalRows: data.length,
        duplicateGroupsBlocked: duplicateGroupCount,
        duplicateRowsBlocked: duplicateRowCount,
        inserted: insertedCount,
        skipped: skippedCount,
        errors: errorCount
      },
      errors: errors.length > 0 ? errors : undefined,
      duration: `${duration}s`
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * 행 데이터의 해시 생성
 * 핵심 필드들만 사용하여 MD5 해시 생성
 */
function generateRowHash(record: any): string {
  // 해시에 포함할 핵심 필드들 (순서 중요)
  const hashFields = {
    invoice_date: record.invoice_date || '',
    invoice: record.invoice || '',
    sales_order: record.sales_order || '',
    item_number: record.item_number || '',
    line_number: record.line_number?.toString() || '0',
    quantity: record.quantity?.toString() || '0',
    line_amount_mst: record.line_amount_mst?.toString() || '0',
    invoice_amount: record.invoice_amount?.toString() || '0',
  };
  
  const hashString = JSON.stringify(hashFields);
  return crypto.createHash('md5').update(hashString).digest('hex');
}


function parseDate(value: any): string | null {
  if (!value) return null;
  try {
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value);
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

function parseYear(value: any): number | null {
  const date = parseDate(value);
  return date ? parseInt(date.split('-')[0]) : null;
}

function parseQuarter(value: any): number | null {
  const date = parseDate(value);
  if (!date) return null;
  const month = parseInt(date.split('-')[1]);
  return Math.ceil(month / 3);
}

function parseMonth(value: any): number | null {
  const date = parseDate(value);
  return date ? parseInt(date.split('-')[1]) : null;
}

function parseNumber(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[,\s$€£¥₩]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}