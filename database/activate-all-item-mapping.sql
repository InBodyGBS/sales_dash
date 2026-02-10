-- Activate ALL item_mapping records (all entities)
-- Use this if you want to activate all item_mapping records

-- Step 1: Check current status
SELECT 
    'BEFORE ACTIVATION' as status,
    entity,
    is_active,
    COUNT(*) as record_count
FROM item_mapping
GROUP BY entity, is_active
ORDER BY entity, is_active;

-- Step 2: Activate all item_mapping records
UPDATE item_mapping
SET 
    is_active = true,
    updated_at = NOW()
WHERE is_active = false;

-- Step 3: Verify activation
SELECT 
    'AFTER ACTIVATION' as status,
    entity,
    is_active,
    COUNT(*) as record_count
FROM item_mapping
GROUP BY entity, is_active
ORDER BY entity, is_active;
