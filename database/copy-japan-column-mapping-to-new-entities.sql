-- Copy Japan's column mapping to Mexico, India, Oceania
-- These entities use the same Excel column structure as Japan

-- Method 1: Copy from Japan's existing mappings
-- This automatically copies all column mappings from Japan to the new entities

-- For Mexico
INSERT INTO column_mapping (entity, excel_column, db_column, is_active)
SELECT 
    'Mexico' as entity,
    excel_column,
    db_column,
    is_active
FROM column_mapping
WHERE entity = 'Japan'
  AND is_active = true
ON CONFLICT (entity, excel_column, db_column) 
DO UPDATE SET 
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- For India
INSERT INTO column_mapping (entity, excel_column, db_column, is_active)
SELECT 
    'India' as entity,
    excel_column,
    db_column,
    is_active
FROM column_mapping
WHERE entity = 'Japan'
  AND is_active = true
ON CONFLICT (entity, excel_column, db_column) 
DO UPDATE SET 
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- For Oceania
INSERT INTO column_mapping (entity, excel_column, db_column, is_active)
SELECT 
    'Oceania' as entity,
    excel_column,
    db_column,
    is_active
FROM column_mapping
WHERE entity = 'Japan'
  AND is_active = true
ON CONFLICT (entity, excel_column, db_column) 
DO UPDATE SET 
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Verify the results
SELECT 
    entity,
    COUNT(*) as mapping_count
FROM column_mapping
WHERE entity IN ('Japan', 'Mexico', 'India', 'Oceania')
  AND is_active = true
GROUP BY entity
ORDER BY entity;

-- Show all mappings for verification
SELECT 
    entity,
    excel_column,
    db_column,
    is_active
FROM column_mapping
WHERE entity IN ('Japan', 'Mexico', 'India', 'Oceania')
  AND is_active = true
ORDER BY entity, excel_column;

