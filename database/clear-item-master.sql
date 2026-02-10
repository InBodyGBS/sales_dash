-- Clear all item_master data
-- This will deactivate all item master mappings (soft delete)
-- To permanently delete, use DELETE instead of UPDATE

-- Option 1: Deactivate all item master mappings (recommended - keeps history)
UPDATE item_master
SET is_active = false,
    updated_at = NOW()
WHERE is_active = true;

-- Check how many records were deactivated
SELECT COUNT(*) as deactivated_count
FROM item_master
WHERE is_active = false;

-- Option 2: Permanently delete all item master mappings (use with caution!)
-- Uncomment the following line if you want to permanently delete:
-- DELETE FROM item_master;
