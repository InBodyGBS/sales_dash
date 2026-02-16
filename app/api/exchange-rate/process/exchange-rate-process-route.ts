import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const { storagePath, fileName } = body;

    if (!storagePath) {
      return NextResponse.json({ error: 'storagePath is required' }, { status: 400 });
    }

    console.log(`📁 Processing exchange rate file: ${fileName}`);

    // 1. Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('sales-files')
      .download(storagePath);

    if (downloadError) {
      console.error('Failed to download file:', downloadError);
      return NextResponse.json({ error: 'Failed to download file', details: downloadError.message }, { status: 500 });
    }

    // 2. Parse Excel file
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (!jsonData || jsonData.length === 0) {
      return NextResponse.json({ error: 'Excel file is empty or has no valid data' }, { status: 400 });
    }

    console.log(`📊 Found ${jsonData.length} rows in Excel file`);

    // 3. Map and validate data
    const rates: { year: number; currency: string; rate: number }[] = [];
    const errors: string[] = [];

    jsonData.forEach((row: any, index: number) => {
      // Try to find year column (case-insensitive)
      const yearKey = Object.keys(row).find(k => k.toLowerCase() === 'year');
      const currencyKey = Object.keys(row).find(k => k.toLowerCase() === 'currency');
      const rateKey = Object.keys(row).find(k => 
        k.toLowerCase() === 'rate' || 
        k.toLowerCase() === 'exchange_rate' || 
        k.toLowerCase() === 'exchange rate' ||
        k.toLowerCase() === 'exchangerate'
      );

      if (!yearKey || !currencyKey || !rateKey) {
        errors.push(`Row ${index + 2}: Missing required columns (year, currency, rate)`);
        return;
      }

      const year = parseInt(row[yearKey]);
      const currency = String(row[currencyKey]).trim().toUpperCase();
      const rate = parseFloat(row[rateKey]);

      if (isNaN(year) || year < 2000 || year > 2100) {
        errors.push(`Row ${index + 2}: Invalid year value: ${row[yearKey]}`);
        return;
      }

      if (!currency || currency.length < 2 || currency.length > 5) {
        errors.push(`Row ${index + 2}: Invalid currency value: ${row[currencyKey]}`);
        return;
      }

      if (isNaN(rate) || rate <= 0) {
        errors.push(`Row ${index + 2}: Invalid rate value: ${row[rateKey]}`);
        return;
      }

      rates.push({ year, currency, rate });
    });

    if (errors.length > 0 && rates.length === 0) {
      return NextResponse.json({ 
        error: 'No valid data found in Excel file', 
        details: errors.slice(0, 10).join('\n') 
      }, { status: 400 });
    }

    console.log(`✅ Validated ${rates.length} exchange rates`);

    // 4. Upsert to database
    const { data, error: upsertError } = await supabase
      .from('exchange_rate')
      .upsert(rates, { onConflict: 'year,currency' })
      .select();

    if (upsertError) {
      console.error('Failed to save exchange rates:', upsertError);
      return NextResponse.json({ error: 'Failed to save exchange rates', details: upsertError.message }, { status: 500 });
    }

    // 5. Clean up uploaded file (optional)
    await supabase.storage.from('sales-files').remove([storagePath]);

    console.log(`✅ Successfully saved ${data?.length || 0} exchange rates`);

    return NextResponse.json({ 
      success: true, 
      count: data?.length || 0,
      warnings: errors.length > 0 ? errors.slice(0, 5) : undefined
    });
  } catch (error) {
    console.error('Exchange rate process API error:', error);
    return NextResponse.json({ error: 'Internal server error', details: (error as Error).message }, { status: 500 });
  }
}
