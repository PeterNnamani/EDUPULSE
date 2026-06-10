-- Support multiple school tiers per institution (nursery through tertiary).
ALTER TABLE schools ADD COLUMN IF NOT EXISTS school_types TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE schools DROP CONSTRAINT IF EXISTS schools_school_type_check;
