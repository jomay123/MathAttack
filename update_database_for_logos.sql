-- Update Supabase database to support Football Badge Attack (logos) game type
-- Run this in your Supabase SQL Editor

-- Update the check constraint to include 'logos' as a valid game type
ALTER TABLE public.daily_scores 
DROP CONSTRAINT IF EXISTS check_game_type;

ALTER TABLE public.daily_scores 
ADD CONSTRAINT check_game_type 
CHECK (game_type IN ('math', 'flags', 'capitals', 'logos'));

-- Verify the constraint was updated
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'check_game_type'; 