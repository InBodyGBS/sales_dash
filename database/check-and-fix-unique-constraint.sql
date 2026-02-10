-- Check existing unique constraint and fix if needed
-- This script will help identify why duplicates might still be getting inserted

-- Step 1: Check if constraint exists and what columns it uses
SELECT 
    'Step 1: Existing Constraint' as step,
    tc.constraint_name,
    tc.constraint_type,
    STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as constraint_columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_name = 'sales_data'
    AND tc.table_schema = 'public'
    AND tc.constraint_name = 'unique_sales_record'
GROUP BY tc.constraint_name, tc.constraint_type;

-- Step 2: Check for duplicates that violate the constraint (should be 0 if constraint works)
SELECT 
    'Step 2: Duplicates Violating Constraint' as step,
    entity,
    invoice,
    invoice_date,
    item_number,
    line_number,
    COUNT(*) as duplicate_count
FROM sales_data
WHERE entity = 'Japan'
    AND invoice IS NOT NULL
    AND invoice_date IS NOT NULL
    AND item_number IS NOT NULL
GROUP BY entity, invoice, invoice_date, item_number, line_number
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 20;

-- Step 3: Check for duplicates with NULL line_number (if constraint allows NULL)
SELECT 
    'Step 3: Duplicates with NULL line_number' as step,
    entity,
    invoice,
    invoice_date,
    item_number,
    line_number,
    COUNT(*) as duplicate_count
FROM sales_data
WHERE entity = 'Japan'
    AND invoice IS NOT NULL
    AND invoice_date IS NOT NULL
    AND item_number IS NOT NULL
    AND line_number IS NULL
GROUP BY entity, invoice, invoice_date, item_number, line_number
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 20;

-- Step 4: Check if constraint columns match what we need
-- Expected: entity, invoice, invoice_date, item_number, line_number
SELECT 
    'Step 4: Constraint Column Check' as step,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'sales_data'
                AND tc.constraint_name = 'unique_sales_record'
                AND kcu.column_name IN ('entity', 'invoice', 'invoice_date', 'item_number', 'line_number')
            GROUP BY tc.constraint_name
            HAVING COUNT(DISTINCT kcu.column_name) = 5
        ) THEN '✅ Constraint has correct columns'
        ELSE '❌ Constraint columns do not match expected columns'
    END as constraint_status;

-- Step 5: If duplicates exist, show sample records
SELECT 
    'Step 5: Sample Duplicate Records' as step,
    id,
    entity,
    invoice,
    invoice_date,
    item_number,
    line_number,
    created_at
FROM sales_data
WHERE (entity, invoice, invoice_date, item_number, line_number) IN (
    SELECT entity, invoice, invoice_date, item_number, line_number
    FROM sales_data
    WHERE entity = 'Japan'
        AND invoice IS NOT NULL
        AND invoice_date IS NOT NULL
        AND item_number IS NOT NULL
    GROUP BY entity, invoice, invoice_date, item_number, line_number
    HAVING COUNT(*) > 1
)
ORDER BY entity, invoice, invoice_date, item_number, line_number, created_at
LIMIT 20;
