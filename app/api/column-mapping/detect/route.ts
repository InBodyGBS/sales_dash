// app/api/column-mapping/detect/route.ts
// Detect Excel columns from uploaded file
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Read Excel file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Get first row as headers
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length === 0) {
      return NextResponse.json(
        { error: 'Excel file is empty' },
        { status: 400 }
      );
    }

    // Get column headers (first row)
    const headers = (jsonData[0] as any[]).filter((h) => h !== null && h !== undefined && h !== '');
    
    // Get available DB columns from schema
    const dbColumns = [
      'sales_type',
      'invoice',
      'voucher',
      'invoice_date',
      'pool',
      'supply_method',
      'sub_method_1',
      'sub_method_2',
      'sub_method_3',
      'application',
      'industry',
      'sub_industry_1',
      'sub_industry_2',
      'general_group',
      'sales_order',
      'account_number',
      'name',
      'name2',
      'customer_invoice_account',
      'invoice_account',
      'group',
      'currency',
      'invoice_amount',
      'invoice_amount_mst',
      'sales_tax_amount',
      'sales_tax_amount_accounting',
      'total_for_invoice',
      'total_mst',
      'open_balance',
      'due_date',
      'sales_tax_group',
      'payment_type',
      'terms_of_payment',
      'payment_schedule',
      'method_of_payment',
      'posting_profile',
      'delivery_terms',
      'h_dim_wk',
      'h_wk_name',
      'h_dim_cc',
      'h_dim_name',
      'line_number',
      'street',
      'city',
      'state',
      'zip_postal_code',
      'final_zipcode',
      'region',
      'product_type',
      'item_group',
      'category',
      'model',
      'item_number',
      'product_name',
      'text',
      'warehouse',
      'name3',
      'quantity',
      'inventory_unit',
      'price_unit',
      'net_amount',
      'line_amount_mst',
      'sales_tax_group2',
      'tax_item_group',
      'mode_of_delivery',
      'dlv_detail',
      'online_order',
      'sales_channel',
      'promotion',
      'second_sales',
      'personnel_number',
      'worker_name',
      'l_dim_name',
      'l_dim_wk',
      'l_wk_name',
      'l_dim_cc',
      'main_account',
      'account_name',
      'rebate',
      'description',
      'country',
      'created_date',
      'created_by',
      'exception',
      'with_collection_agency',
      'credit_rating',
    ];

    return NextResponse.json({
      success: true,
      excelColumns: headers,
      dbColumns,
    });
  } catch (error) {
    console.error('Error detecting columns:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to detect columns',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

