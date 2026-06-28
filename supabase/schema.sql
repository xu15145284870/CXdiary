-- ============================================
-- 葱蒜的考研日记 — Supabase 数据库建表脚本
-- 在 Supabase SQL Editor 中执行此文件
-- ============================================

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pair_code TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('cong', 'suan')),
  nickname TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引：按配对码查找
CREATE INDEX IF NOT EXISTS idx_users_pair_code ON users(pair_code);

-- 2. 签到表
CREATE TABLE IF NOT EXISTS checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pair_code TEXT NOT NULL,
  role TEXT NOT NULL,
  date DATE NOT NULL,
  emoji TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pair_code, role, date)
);

CREATE INDEX IF NOT EXISTS idx_checkins_pair_date ON checkins(pair_code, date);

-- 3. 日记表
CREATE TABLE IF NOT EXISTS journals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pair_code TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT DEFAULT '',
  images TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journals_pair ON journals(pair_code);

-- 4. 番茄钟设置表
CREATE TABLE IF NOT EXISTS pomodoro_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pair_code TEXT NOT NULL,
  role TEXT NOT NULL,
  work_minutes INT DEFAULT 25,
  break_minutes INT DEFAULT 5,
  UNIQUE(pair_code, role)
);

-- ===== RLS 策略：允许匿名读写（双人私密使用） =====
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE pomodoro_settings ENABLE ROW LEVEL SECURITY;

-- 允许所有操作（两人小应用，信任对方）
CREATE POLICY "allow_all_users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_checkins" ON checkins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_journals" ON journals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_pomodoro" ON pomodoro_settings FOR ALL USING (true) WITH CHECK (true);

-- ===== 存储桶：日记图片 (在 Supabase Dashboard → Storage 中手动创建) =====
-- 1. 创建名为 "journals" 的公开存储桶
-- 2. 设置其策略为允许公开读写
