-- Add India, Mexico, Oceania to entity check constraints
-- This enables item mapping for these new entities

-- 1. Update item_mapping table constraint
ALTER TABLE item_mapping 
DROP CONSTRAINT IF EXISTS valid_entity_item_mapping;

ALTER TABLE item_mapping 
ADD CONSTRAINT valid_entity_item_mapping 
CHECK (entity IN ('HQ', 'USA', 'BWA', 'Vietnam', 'Healthcare', 'Korot', 'Japan', 'China', 'India', 'Mexico', 'Oceania'));

-- 2. Update column_mapping table constraint
ALTER TABLE column_mapping 
DROP CONSTRAINT IF EXISTS valid_entity_mapping;

ALTER TABLE column_mapping 
ADD CONSTRAINT valid_entity_mapping 
CHECK (entity IN ('HQ', 'USA', 'BWA', 'Vietnam', 'Healthcare', 'Korot', 'Japan', 'China', 'India', 'Mexico', 'Oceania'));

-- 3. Update sales_data table constraint (if exists)
ALTER TABLE sales_data 
DROP CONSTRAINT IF EXISTS valid_entity;

ALTER TABLE sales_data 
ADD CONSTRAINT valid_entity 
CHECK (entity IN ('HQ', 'USA', 'BWA', 'Vietnam', 'Healthcare', 'Korot', 'Japan', 'China', 'India', 'Mexico', 'Oceania'));

-- 4. Update upload_history table constraint (if exists)
-- Note: upload_history might not have entity constraint, so we check first
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'upload_history' 
        AND constraint_name = 'valid_entity_upload_history'
    ) THEN
        ALTER TABLE upload_history DROP CONSTRAINT valid_entity_upload_history;
    END IF;
END $$;

-- Verify the changes
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname LIKE '%valid_entity%'
ORDER BY table_name, constraint_name;

