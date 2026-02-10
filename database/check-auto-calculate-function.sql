-- Check the auto_calculate_derived_columns function
-- This function might be overriding fg_classification

-- 1. Get the function definition
SELECT 
    'Function Definition' as check_type,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'auto_calculate_derived_columns';

-- 2. Check what columns this function might be setting
SELECT 
    'Function Parameters' as check_type,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'auto_calculate_derived_columns';
