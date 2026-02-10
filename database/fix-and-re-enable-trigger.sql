-- Step 1: Check current function definition
-- Run this first to see what the function does
SELECT 
    'Current Function Definition' as step,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'auto_calculate_derived_columns';

-- Step 2: Modify the function to preserve fg_classification from item_mapping/item_master
-- This version will NOT override fg_classification if it's already set or if there's a mapping
CREATE OR REPLACE FUNCTION auto_calculate_derived_columns()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set fg_classification to 'NonFG' if:
    -- 1. It's currently NULL or empty
    -- 2. AND there's NO matching item_master entry with fg_classification
    -- 3. AND there's NO matching item_mapping entry with fg_classification
    
    -- Check if there's a matching item_master entry with fg_classification
    IF EXISTS (
        SELECT 1 FROM item_master 
        WHERE item_number = NEW.item_number 
        AND is_active = true
        AND fg_classification IS NOT NULL
        AND fg_classification != ''
    ) THEN
        -- Don't override - item_master will be used via UPDATE queries
        -- Just leave NEW.fg_classification as is
        NULL;
    -- Check if there's a matching item_mapping entry with fg_classification
    ELSIF EXISTS (
        SELECT 1 FROM item_mapping 
        WHERE item_number = NEW.item_number 
        AND entity = NEW.entity
        AND is_active = true
        AND fg_classification IS NOT NULL
        AND fg_classification != ''
    ) THEN
        -- Don't override - item_mapping will be used via UPDATE queries
        -- Just leave NEW.fg_classification as is
        NULL;
    -- Only set to NonFG if no mapping exists AND it's currently NULL/empty
    ELSIF NEW.fg_classification IS NULL OR NEW.fg_classification = '' THEN
        NEW.fg_classification := 'NonFG';
    END IF;
    
    -- Add other derived column calculations here if needed
    -- (e.g., channel calculation is handled by another trigger)
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Verify the function was updated
SELECT 
    'Function Updated' as step,
    CASE 
        WHEN pg_get_functiondef(p.oid)::text LIKE '%item_mapping%' THEN 'YES - Checks item_mapping'
        ELSE 'NO - Does not check item_mapping'
    END as checks_item_mapping,
    CASE 
        WHEN pg_get_functiondef(p.oid)::text LIKE '%item_master%' THEN 'YES - Checks item_master'
        ELSE 'NO - Does not check item_master'
    END as checks_item_master
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'auto_calculate_derived_columns';

-- Step 4: Re-enable the trigger
ALTER TABLE sales_data ENABLE TRIGGER trg_calculate_derived_columns;

-- Step 5: Verify trigger is enabled
SELECT 
    'Trigger Status' as step,
    tgname as trigger_name,
    CASE 
        WHEN tgenabled = 'O' THEN 'ENABLED ✅'
        WHEN tgenabled = 'D' THEN 'DISABLED ❌'
        ELSE 'UNKNOWN'
    END as status
FROM pg_trigger
WHERE tgrelid = 'sales_data'::regclass
  AND tgname = 'trg_calculate_derived_columns';

-- Step 6: Test - Check if 270S_O still has FG after trigger re-enable
SELECT 
    'Test After Re-enable' as step,
    entity,
    item_number,
    fg_classification,
    COUNT(*) as record_count
FROM sales_data
WHERE item_number = '270S_O'
  AND entity = 'Japan'
GROUP BY entity, item_number, fg_classification;
