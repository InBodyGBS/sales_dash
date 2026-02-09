-- Add storage_path column to upload_history table if it doesn't exist
-- This column stores the Supabase Storage path for uploaded files

-- Check if column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'upload_history' 
        AND column_name = 'storage_path'
    ) THEN
        ALTER TABLE upload_history ADD COLUMN storage_path VARCHAR(500);
        COMMENT ON COLUMN upload_history.storage_path IS 'Supabase Storage path for the uploaded file';
    END IF;
END $$;

