-- Clear all item_mapping data
-- This will deactivate all item mappings (soft delete)
-- To permanently delete, use DELETE instead of UPDATE

-- Option 1: Deactivate all item mappings (recommended - keeps history)
UPDATE item_mapping
SET is_active = false,
    updated_at = NOW()
WHERE is_active = true;

-- Check how many records were deactivated
SELECT 
    entity,
    COUNT(*) as deactivated_count
FROM item_mapping
WHERE is_active = false
GROUP BY entity
ORDER BY entity;

-- Option 2: Permanently delete all item mappings (use with caution!)
-- Uncomment the following lines if you want to permanently delete:
-- DELETE FROM item_mapping;

-- Option 3: Delete only for specific entity (e.g., Japan)
-- UPDATE item_mapping
-- SET is_active = false,
--     updated_at = NOW()
-- WHERE entity = 'Japan' AND is_active = true;
