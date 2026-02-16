// app/api/exchange-rate/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    console.log(`📁 Processing Exchange Rate file: ${file.name}`);

    // Parse Excel file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) {
      return NextResponse.json(
        { error: 'Excel file is empty' },
        { status: 400 }
      );
    }

    console.log(`📊 Parsed ${jsonData.length} rows from Excel`);

    // Expected columns: year, currency, rate
    const detectColumn = (row: any, possibleNames: string[]): string | null => {
      for (const name of possibleNames) {
        const keys = Object.keys(row);
        const found = keys.find(key => key.toLowerCase() === name.toLowerCase());
        if (found) return found;
      }
      return null;
    };

    const firstRow = jsonData[0] as any;
    const yearCol = detectColumn(firstRow, ['year']);
    const currencyCol = detectColumn(firstRow, ['currency', 'curr', 'cur']);
    const rateCol = detectColumn(firstRow, ['rate', 'exchange_rate', 'exchange rate']);

    if (!yearCol || !currencyCol || !rateCol) {
      return NextResponse.json(
        { 
          error: 'Required columns not found. Expected: year, currency, rate',
          found: {
            year: !!yearCol,
            currency: !!currencyCol,
            rate: !!rateCol
          }
        },
        { status: 400 }
      );
    }

    // Transform data
    const rates = jsonData
      .map((row: any, index: number) => {
        const year = parseInt(row[yearCol]);
        const currency = row[currencyCol]?.toString().trim();
        const rate = parseFloat(row[rateCol]);

        if (isNaN(year) || year < 2000 || year > 2100) {
          console.warn(`Row ${index + 2}: Invalid year ${row[yearCol]}, skipping`);
          return null;
        }

        if (!currency) {
          console.warn(`Row ${index + 2}: Currency is required, skipping`);
          return null;
        }

        if (isNaN(rate) || rate <= 0) {
          console.warn(`Row ${index + 2}: Invalid rate for ${currency}, skipping`);
          return null;
        }

        return {
          year,
          currency,
          rate,
        };
      })
      .filter((rate): rate is NonNullable<typeof rate> => rate !== null);

    if (rates.length === 0) {
      return NextResponse.json(
        { error: 'No valid exchange rate data found in file' },
        { status: 400 }
      );
    }

    console.log(`✅ Parsed ${rates.length} valid exchange rates`);

    // Insert into database
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('exchange_rate')
      .upsert(rates, {
        onConflict: 'year,currency',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error('Error inserting exchange rates:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded ${rates.length} exchange rates`,
      count: rates.length,
      rates: data,
    });
  } catch (error) {
    console.error('Error processing exchange rate file:', error);
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

