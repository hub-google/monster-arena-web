-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  gold integer DEFAULT 500,
  premium_gems integer DEFAULT 0,
  stamina integer DEFAULT 500,
  max_stamina integer DEFAULT 500,
  last_login_at timestamp with time zone DEFAULT now(),
  stamina_updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- MONSTERS TABLE
CREATE TABLE IF NOT EXISTS monsters (
  monster_id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
  parent_1_id uuid,
  parent_2_id uuid,
  name text,
  custom_name text,
  generation integer DEFAULT 1,
  type smallint DEFAULT 1,
  family smallint DEFAULT 1,
  life_stage smallint DEFAULT 1,
  age_days double precision DEFAULT 0,
  fullness double precision DEFAULT 100,
  cleanliness integer DEFAULT 100,
  is_sick boolean DEFAULT false,
  sick_time_start timestamp with time zone,
  starve_time_start timestamp with time zone,
  dirty_time_start timestamp with time zone,
  last_healed_at timestamp with time zone,
  sleep_until timestamp with time zone,
  hunger_mistake_logged boolean DEFAULT false,
  sick_mistake_logged boolean DEFAULT false,
  poop_mistake_logged boolean DEFAULT false,
  sleep_poop_mistake_logged boolean DEFAULT false,
  neglect_count integer DEFAULT 0,
  train_count integer DEFAULT 0,
  is_dead boolean DEFAULT false,
  is_frozen boolean DEFAULT false,
  death_reason text,
  iv double precision DEFAULT 0,
  traits text[] DEFAULT '{}',
  gene_hp double precision DEFAULT 0,
  gene_atk double precision DEFAULT 0,
  gene_def double precision DEFAULT 0,
  gene_spd double precision DEFAULT 0,
  combat_hp double precision DEFAULT 0,
  combat_atk double precision DEFAULT 0,
  combat_def double precision DEFAULT 0,
  combat_spd double precision DEFAULT 0,
  chip_slot_1 text,
  chip_slot_1_val double precision DEFAULT 0,
  chip_slot_2 text,
  chip_slot_2_val double precision DEFAULT 0,
  battles integer DEFAULT 0,
  wins integer DEFAULT 0,
  is_locked boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  last_updated_at timestamp with time zone DEFAULT now()
);

-- USER INVENTORY TABLE
CREATE TABLE IF NOT EXISTS user_inventory (
  inventory_id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
  item_type smallint DEFAULT 1,
  item_id text NOT NULL,
  quantity integer DEFAULT 0,
  UNIQUE (user_id, item_id)
);

-- GUILDS TABLE
CREATE TABLE IF NOT EXISTS guilds (
  guild_id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  guild_name text UNIQUE NOT NULL,
  leader_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  level integer DEFAULT 1,
  total_contribution integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- GUILD MEMBERS TABLE
CREATE TABLE IF NOT EXISTS guild_members (
  member_id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  guild_id uuid REFERENCES guilds(guild_id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
  role smallint DEFAULT 0,
  contribution integer DEFAULT 0,
  UNIQUE(guild_id, user_id)
);

-- GUILD APPLICATIONS TABLE
CREATE TABLE IF NOT EXISTS guild_applications (
  application_id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  guild_id uuid REFERENCES guilds(guild_id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(guild_id, user_id)
);

-- FRIENDS TABLE
CREATE TABLE IF NOT EXISTS friends (
  friend_record_id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
  friend_uid uuid REFERENCES users(user_id) ON DELETE CASCADE,
  friend_name text,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, friend_uid)
);

-- CHALLENGES TABLE
CREATE TABLE IF NOT EXISTS challenges (
  challenge_id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  challenger_uid uuid REFERENCES users(user_id) ON DELETE CASCADE,
  challenger_name text,
  target_uid uuid REFERENCES users(user_id) ON DELETE CASCADE,
  status text DEFAULT 'pending',
  monster_data jsonb,
  target_monster jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- DAILY QUESTS TABLE
CREATE TABLE IF NOT EXISTS daily_quests (
  quest_id text PRIMARY KEY,
  user_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
  date text,
  feed_count integer DEFAULT 0,
  train_count integer DEFAULT 0,
  battle_count integer DEFAULT 0,
  claimed text[] DEFAULT '{}'
);

-- TRIGGERS & RLS (Basic)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE monsters ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own profile" ON users FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view profiles" ON users FOR SELECT USING (true);

CREATE POLICY "Users can manage their own monsters" ON monsters FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view monsters" ON monsters FOR SELECT USING (true);

CREATE POLICY "Users can manage their own inventory" ON user_inventory FOR ALL USING (auth.uid() = user_id);

-- Add simple helper for decrementing gold safely (Example RPC)
CREATE OR REPLACE FUNCTION deduct_gold(amount integer) RETURNS void AS $$
BEGIN
  UPDATE users SET gold = gold - amount WHERE user_id = auth.uid() AND gold >= amount;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient gold';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
