import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';

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

    let insertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // 🔥 배치 처리 + 에러 캐치
    const BATCH_SIZE = 100;  // 작은 배치로 변경
    
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      
      console.log(`⚙️  Batch ${batchNumber}: ${batch.length} rows`);

      // 배치를 하나씩 INSERT 시도
      for (let j = 0; j < batch.length; j++) {
        const row: any = batch[j];
        const rowNumber = i + j + 2;  // Excel row number

        try {
          const record = {
            entity: entity,
            year: parseYear(row['Invoice Date']),
            quarter: parseQuarter(row['Invoice Date']),
            month: parseMonth(row['Invoice Date']),
            invoice_date: parseDate(row['Invoice Date']),
            invoice: row['Invoice']?.toString() || null,
            item_number: row['Item Number']?.toString() || null,
            quantity: parseNumber(row['Quantity']),
            line_amount_mst: parseNumber(row['Line Amount MST']),
            invoice_amount: parseNumber(row['Invoice Amount']),
            currency: row['Currency']?.toString() || null,
            industry: row['Industry']?.toString() || null,
            sales_channel: row['Sales Channel']?.toString() || null,
            country: row['Country']?.toString() || null,
            created_at: new Date().toISOString(),
          };

          if (!record.invoice || !record.item_number) {
            skippedCount++;
            continue;
          }

          const { error } = await supabase
            .from('sales_data')
            .insert([record]);

          if (error) {
            if (error.code === '23505') {  // 중복 에러
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