-- Fix the auto_calculate_derived_columns trigger issue
-- This trigger might be overriding fg_classification updates

-- Step 1: Check the current function definition
SELECT 
    'Current Function' as step,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'auto_calculate_derived_columns';

-- Step 2: Temporarily disable the trigger to test
-- Uncomment the following line to disable the trigger:
-- ALTER TABLE sales_data DISABLE TRIGGER trg_calculate_derived_columns;

-- Step 3: Check if fg_classification is being set in the function
-- Run this to see what the function does:
SELECT 
    'Function Code Check' as step,
    CASE 
        WHEN pg_get_functiondef(p.oid)::text LIKE '%fg_classification%' THEN 'YES - Function sets fg_classification'
        ELSE 'NO - Function does not set fg_classification'
    END as sets_fg_classification
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'auto_calculate_derived_columns';

-- Step 4: Option A - Modify the function to skip fg_classification if it's already set
-- (This requires seeing the function definition first)

-- Step 5: Option B - Drop and recreate the trigger to exclude fg_classification updates
-- First, let's see the trigger definition:
SELECT 
    'Trigger Definition' as step,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trg_calculate_derived_columns';
