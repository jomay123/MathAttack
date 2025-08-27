-- Setup Currency System Database Schema
-- Run this in your Supabase SQL Editor to fix the 403 errors

-- 1. Add currency column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS coins INTEGER DEFAULT 0;

-- 2. Create achievements table
CREATE TABLE IF NOT EXISTS public.achievements (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT DEFAULT '🏆',
    coins_reward INTEGER DEFAULT 0,
    requirement_type TEXT NOT NULL, -- 'math_questions', 'flags_questions', 'capitals_questions', 'logos_questions', 'daily_wins', 'high_score'
    requirement_value INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create user_achievements table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.user_achievements (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    achievement_id INTEGER REFERENCES public.achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

-- 4. Create avatars table
CREATE TABLE IF NOT EXISTS public.avatars (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    cost INTEGER DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create user_avatars table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.user_avatars (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    avatar_id INTEGER REFERENCES public.avatars(id) ON DELETE CASCADE,
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_equipped BOOLEAN DEFAULT false,
    UNIQUE(user_id, avatar_id)
);

-- 6. Add current_avatar_id to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS current_avatar_id INTEGER REFERENCES public.avatars(id);

-- 7. Insert sample achievements
INSERT INTO public.achievements (name, description, icon, coins_reward, requirement_type, requirement_value) VALUES
('Math Master', 'Answer 100 math questions correctly', '🧮', 50, 'math_questions', 100),
('Flag Explorer', 'Answer 50 flag questions correctly', '🏁', 30, 'flags_questions', 50),
('Capital Connoisseur', 'Answer 50 capital questions correctly', '🏛️', 30, 'capitals_questions', 50),
('Badge Collector', 'Answer 50 football badge questions correctly', '⚽', 30, 'logos_questions', 50),
('Daily Champion', 'Win 5 daily competitions', '👑', 100, 'daily_wins', 5),
('High Scorer', 'Achieve a new high score', '⭐', 25, 'high_score', 1),
('Question Crusher', 'Answer 500 total questions correctly', '💪', 150, 'total_questions', 500),
('Speed Demon', 'Answer 10 questions in under 5 seconds total', '⚡', 75, 'speed_questions', 10)
ON CONFLICT (name) DO NOTHING;

-- 8. Insert sample avatars
INSERT INTO public.avatars (name, image_url, cost, is_default) VALUES
('Default', '👤', 0, true),
('Math Wizard', '🧙‍♂️', 100, false),
('Flag Hunter', '🏴', 150, false),
('Capital King', '👑', 200, false),
('Football Star', '⚽', 250, false),
('Coin Collector', '💰', 500, false)
ON CONFLICT (name) DO NOTHING;

-- 9. Set default avatar for existing users
UPDATE public.users 
SET current_avatar_id = (SELECT id FROM public.avatars WHERE is_default = true LIMIT 1)
WHERE current_avatar_id IS NULL;

-- 10. Enable RLS on new tables
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_avatars ENABLE ROW LEVEL SECURITY;

-- 11. Create RLS policies
-- Achievements: everyone can read
CREATE POLICY "Anyone can read achievements" ON public.achievements FOR SELECT USING (true);

-- User achievements: users can read their own
CREATE POLICY "Users can read their own achievements" ON public.user_achievements FOR SELECT USING (auth.uid() = user_id);

-- Avatars: everyone can read
CREATE POLICY "Anyone can read avatars" ON public.avatars FOR SELECT USING (true);

-- User avatars: users can read and insert their own
CREATE POLICY "Users can read their own avatars" ON public.user_avatars FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own avatars" ON public.user_avatars FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own avatars" ON public.user_avatars FOR UPDATE USING (auth.uid() = user_id);

-- 12. Grant permissions
GRANT SELECT ON public.achievements TO authenticated, anon;
GRANT SELECT, INSERT ON public.user_achievements TO authenticated;
GRANT SELECT ON public.avatars TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.user_avatars TO authenticated;
GRANT UPDATE ON public.users TO authenticated;

-- 13. Verify the setup
SELECT 'Currency system setup complete!' as status;
SELECT 'Tables created:' as info;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('achievements', 'user_achievements', 'avatars', 'user_avatars')
ORDER BY table_name;

-- 14. Check if users table has coins column
SELECT 'Users table check:' as info;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public' 
AND column_name = 'coins'; 