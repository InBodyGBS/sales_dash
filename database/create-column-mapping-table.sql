-- Create column_mapping table to store Excel column to DB column mappings per entity
CREATE TABLE IF NOT EXISTS column_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity VARCHAR(50) NOT NULL,
    excel_column VARCHAR(200) NOT NULL,
    db_column VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(entity, excel_column, db_column),
    CONSTRAINT valid_entity_mapping CHECK (entity IN ('HQ', 'USA', 'BWA', 'Vietnam', 'Healthcare', 'Korot', 'Japan', 'China'))
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_column_mapping_entity ON column_mapping(entity);
CREATE INDEX IF NOT EXISTS idx_column_mapping_active ON column_mapping(entity, is_active) WHERE is_active = true;

-- Add comment
COMMENT ON TABLE column_mapping IS 'Stores Excel column to database column mappings for each entity';

