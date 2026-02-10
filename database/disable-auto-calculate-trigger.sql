-- Temporarily disable the auto_calculate_derived_columns trigger
-- This will allow manual updates to fg_classification to work

-- Step 1: Disable the trigger
ALTER TABLE sales_data DISABLE TRIGGER trg_calculate_derived_columns;

-- Step 2: Verify the trigger is disabled
SELECT 
    'Trigger Status' as check_type,
    tgname as trigger_name,
    CASE 
        WHEN tgisinternal THEN 'INTERNAL'
        ELSE 'USER'
    END as trigger_type,
    CASE 
        WHEN tgenabled = 'O' THEN 'ENABLED'
        WHEN tgenabled = 'D' THEN 'DISABLED'
        ELSE 'UNKNOWN'
    END as status
FROM pg_trigger
WHERE tgrelid = 'sales_data'::regclass
  AND tgname = 'trg_calculate_derived_columns';

-- Step 3: Now try updating fg_classification
-- After disabling, run your update queries
-- Example:
-- UPDATE sales_data
-- SET fg_classification = 'FG'
-- WHERE item_number = '270S_O' AND entity = 'Japan';

-- Step 4: Re-enable the trigger when done (if needed)
-- ALTER TABLE sales_data ENABLE TRIGGER trg_calculate_derived_columns;
