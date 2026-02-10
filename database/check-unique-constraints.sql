-- Check if unique constraints exist on sales_data table
-- This will help identify why duplicate records might be getting inserted

-- 1. Check all constraints on sales_data table
SELECT 
    'All Constraints' as check_type,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    tc.table_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_name = 'sales_data'
    AND tc.table_schema = 'public'
ORDER BY tc.constraint_type, tc.constraint_name, kcu.ordinal_position;

-- 2. Check for unique constraints specifically
SELECT 
    'Unique Constraints' as check_type,
    tc.constraint_name,
    STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_name = 'sales_data'
    AND tc.table_schema = 'public'
    AND tc.constraint_type = 'UNIQUE'
GROUP BY tc.constraint_name
ORDER BY tc.constraint_name;

-- 3. Check for unique indexes (which might act as constraints)
SELECT 
    'Unique Indexes' as check_type,
    indexname as index_name,
    indexdef as index_definition
FROM pg_indexes
WHERE tablename = 'sales_data'
    AND schemaname = 'public'
    AND indexdef LIKE '%UNIQUE%'
ORDER BY indexname;

-- 4. Sample duplicate records (if any) for Japan entity
SELECT 
    'Sample Duplicates (Japan)' as check_type,
    entity,
    invoice,
    invoice_date,
    item_number,
    line_number,
    COUNT(*) as duplicate_count
FROM sales_data
WHERE entity = 'Japan'
GROUP BY entity, invoice, invoice_date, item_number, line_number
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, invoice, invoice_date
LIMIT 10;
