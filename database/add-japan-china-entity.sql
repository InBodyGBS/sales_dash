-- Add Japan and China to entity constraint
-- Run this to update the existing sales_data table

-- First, drop the existing constraint
ALTER TABLE sales_data DROP CONSTRAINT IF EXISTS valid_entity;

-- Add new constraint with Japan and China
ALTER TABLE sales_data ADD CONSTRAINT valid_entity 
  CHECK (entity IN ('HQ', 'USA', 'BWA', 'Vietnam', 'Healthcare', 'Korot', 'Japan', 'China'));

