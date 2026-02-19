-- sales_data 테이블의 unique constraint 확인
-- 이 스크립트로 중복 방지 제약조건이 있는지 확인할 수 있습니다

-- 1. 모든 constraint 확인
SELECT 
    'All Constraints' as check_type,
    tc.constraint_name,
    tc.constraint_type,
    STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_name = 'sales_data'
    AND tc.table_schema = 'public'
GROUP BY tc.constraint_name, tc.constraint_type
ORDER BY tc.constraint_type, tc.constraint_name;

-- 2. Unique constraint만 확인
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

-- 3. Unique index 확인 (constraint로 사용될 수 있음)
SELECT 
    'Unique Indexes' as check_type,
    indexname as index_name,
    indexdef as index_definition
FROM pg_indexes
WHERE tablename = 'sales_data'
    AND schemaname = 'public'
    AND indexdef LIKE '%UNIQUE%'
ORDER BY indexname;

-- 4. Primary key 확인
SELECT 
    'Primary Key' as check_type,
    tc.constraint_name,
    STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_name = 'sales_data'
    AND tc.table_schema = 'public'
    AND tc.constraint_type = 'PRIMARY KEY'
GROUP BY tc.constraint_name;

-- 5. Japan entity의 중복 레코드 확인
SELECT 
    'Japan Duplicates' as check_type,
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
ORDER BY duplicate_count DESC, invoice, invoice_date
LIMIT 20;

-- 6. Japan entity의 중복 레코드 상세 (샘플)
SELECT 
    'Japan Duplicate Details' as check_type,
    id,
    entity,
    invoice,
    invoice_date,
    item_number,
    line_number,
    line_amount_mst,
    quantity,
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
LIMIT 50;
