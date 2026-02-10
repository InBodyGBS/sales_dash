-- Modify auto_calculate_derived_columns to preserve fg_classification from item_mapping
-- This function should NOT override fg_classification if it's being set from item_mapping

-- IMPORTANT: First run check-auto-calculate-function.sql to see the current function definition
-- Then modify this script based on what you see

-- Step 1: Create a new version that preserves fg_classification from item_mapping
CREATE OR REPLACE FUNCTION auto_calculate_derived_columns()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set fg_classification to 'NonFG' if:
    -- 1. It's currently NULL or empty
    -- 2. AND there's no matching item_master or item_mapping entry
    
    -- Check if there's a matching item_master entry
    IF EXISTS (
        SELECT 1 FROM item_master 
        WHERE item_number = NEW.item_number 
        AND is_active = true
        AND fg_classification IS NOT NULL
    ) THEN
        -- Don't override - item_master will be used
        NULL;
    -- Check if there's a matching item_mapping entry
    ELSIF EXISTS (
        SELECT 1 FROM item_mapping 
        WHERE item_number = NEW.item_number 
        AND entity = NEW.entity
        AND is_active = true
        AND fg_classification IS NOT NULL
    ) THEN
        -- Don't override - item_mapping will be used
        NULL;
    -- Only set to NonFG if no mapping exists
    ELSIF NEW.fg_classification IS NULL OR NEW.fg_classification = '' THEN
        NEW.fg_classification := 'NonFG';
    END IF;
    
    -- Add other derived column calculations here (if any)
    -- For example: channel, etc.
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Verify the function was updated
SELECT 
    'Function Updated' as status,
    p.proname as function_name,
    CASE 
        WHEN pg_get_functiondef(p.oid)::text LIKE '%item_mapping%' THEN 'YES - Checks item_mapping'
        ELSE 'NO - Does not check item_mapping'
    END as checks_item_mapping
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'auto_calculate_derived_columns';
