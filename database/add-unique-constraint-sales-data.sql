-- Add unique constraint to prevent duplicate records in sales_data
-- This will ensure that duplicate records are not inserted

-- Step 1: Check if constraint already exists
SELECT 
    'Existing Constraints' as step,
    tc.constraint_name,
    tc.constraint_type,
    STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_name = 'sales_data'
    AND tc.table_schema = 'public'
    AND tc.constraint_type = 'UNIQUE'
GROUP BY tc.constraint_name, tc.constraint_type
ORDER BY tc.constraint_name;

-- Step 2: Check for existing duplicates before adding constraint
SELECT 
    'Existing Duplicates' as step,
    entity,
    invoice,
    invoice_date,
    item_number,
    line_number,
    COUNT(*) as duplicate_count
FROM sales_data
GROUP BY entity, invoice, invoice_date, item_number, line_number
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 20;

-- Step 3: Remove duplicates (keep the first one, delete the rest)
-- Uncomment and run this if you want to remove existing duplicates first
/*
DELETE FROM sales_data
WHERE id NOT IN (
    SELECT MIN(id)
    FROM sales_data
    GROUP BY entity, invoice, invoice_date, item_number, line_number
);
*/

-- Step 4: Check existing constraint definition
SELECT 
    'Existing Constraint Details' as step,
    tc.constraint_name,
    tc.constraint_type,
    STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_name = 'sales_data'
    AND tc.table_schema = 'public'
    AND tc.constraint_name = 'unique_sales_record'
GROUP BY tc.constraint_name, tc.constraint_type;

-- Step 5: If constraint exists but doesn't match what we need, drop and recreate
-- Uncomment the following if you need to modify the constraint:
/*
-- Drop existing constraint
ALTER TABLE sales_data DROP CONSTRAINT IF EXISTS unique_sales_record;

-- Add new constraint with correct columns
ALTER TABLE sales_data
ADD CONSTRAINT unique_sales_record 
UNIQUE (entity, invoice, invoice_date, item_number, line_number);
*/

-- Option B: If you want to allow NULL line_number to be treated as distinct:
-- (This requires a partial unique index instead)
/*
CREATE UNIQUE INDEX unique_sales_record_with_null_line
ON sales_data (entity, invoice, invoice_date, item_number, COALESCE(line_number, -1))
WHERE invoice IS NOT NULL 
  AND invoice_date IS NOT NULL 
  AND item_number IS NOT NULL;
*/

-- Step 5: Verify constraint was added
SELECT 
    'Constraint Added' as step,
    tc.constraint_name,
    tc.constraint_type,
    STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_name = 'sales_data'
    AND tc.table_schema = 'public'
    AND tc.constraint_name = 'unique_sales_record'
GROUP BY tc.constraint_name, tc.constraint_type;
