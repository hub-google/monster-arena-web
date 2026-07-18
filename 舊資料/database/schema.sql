-- ============================================================================
-- Monster Arena Web - Supabase PostgreSQL Schema Setup
-- ============================================================================

-- Drop tables if they exist to allow clean runs
DROP TABLE IF EXISTS friends CASCADE;
DROP TABLE IF EXISTS guild_members CASCADE;
DROP TABLE IF EXISTS guilds CASCADE;
DROP TABLE IF EXISTS user_inventory CASCADE;
DROP TABLE IF EXISTS monsters CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS world_boss CASCADE;

-- 1. Users Table
CREATE TABLE users (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    gold INT DEFAULT 500,
    premium_gems INT DEFAULT 0,
    stamina INT DEFAULT 10,
    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for username lookups
CREATE INDEX idx_users_username ON users(username);

-- 2. Monsters Table
CREATE TABLE monsters (
    monster_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    parent_1_id BIGINT REFERENCES monsters(monster_id) ON DELETE SET NULL,
    parent_2_id BIGINT REFERENCES monsters(monster_id) ON DELETE SET NULL,
    name VARCHAR(50) NOT NULL,
    generation INT DEFAULT 1,
    type SMALLINT NOT NULL, -- 1: 疫苗種, 2: 資料種, 3: 病毒種
    life_stage SMALLINT DEFAULT 1, -- 1:蛋, 2:幼年期, 3:成長期, 4:成熟期, 5:完全體, 6:究極體
    age_days INT DEFAULT 0,
    fullness INT DEFAULT 100,
    cleanliness INT DEFAULT 100,
    is_sick BOOLEAN DEFAULT FALSE,
    sick_time_start TIMESTAMP WITH TIME ZONE,
    starve_time_start TIMESTAMP WITH TIME ZONE,
    sleep_until BIGINT, -- Use BIGINT for JS timestamp compatibility
    is_dead BOOLEAN DEFAULT FALSE,
    death_reason VARCHAR(50),
    gene_hp DOUBLE PRECISION NOT NULL,
    gene_atk DOUBLE PRECISION NOT NULL,
    gene_def DOUBLE PRECISION NOT NULL,
    gene_spd DOUBLE PRECISION NOT NULL,
    combat_hp DOUBLE PRECISION NOT NULL,
    combat_atk DOUBLE PRECISION NOT NULL,
    combat_def DOUBLE PRECISION NOT NULL,
    combat_spd DOUBLE PRECISION NOT NULL,
    mutation_status SMALLINT DEFAULT 0, -- 0:正常, 1:黃金突變, 2:超黃金突變
    breed_cooldown_until TIMESTAMP WITH TIME ZONE,
    training_count INT DEFAULT 0,
    neglect_count INT DEFAULT 0,
    wins INT DEFAULT 0,
    battles INT DEFAULT 0,
    is_locked BOOLEAN DEFAULT FALSE,
    chip_slot_1 VARCHAR(50),
    chip_slot_1_val DOUBLE PRECISION DEFAULT 0,
    chip_slot_2 VARCHAR(50),
    chip_slot_2_val DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for owner queries and death stats
CREATE INDEX idx_monsters_owner ON monsters(owner_id, is_dead);

-- 3. User Inventory Table
CREATE TABLE user_inventory (
    inventory_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    item_type SMALLINT NOT NULL, -- 1:飼料, 2:醫療藥水, 3:繁衍催化劑, 4:基因晶片
    item_id VARCHAR(50) NOT NULL, -- e.g. 'meat_basic', 'medicine_standard', 'chip_atk_01'
    quantity INT DEFAULT 1,
    atk_bonus_val DOUBLE PRECISION DEFAULT 0,
    CONSTRAINT unique_user_item UNIQUE (user_id, item_id)
);

-- Index for inventory queries
CREATE INDEX idx_inventory_user ON user_inventory(user_id);

-- 4. Guilds Table
CREATE TABLE guilds (
    guild_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    guild_name VARCHAR(50) UNIQUE NOT NULL,
    leader_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    level INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Guild Members Table
CREATE TABLE guild_members (
    guild_id BIGINT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role SMALLINT DEFAULT 0, -- 0:普通成員, 1:會長, 2:副會長
    contribution INT DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
);

-- Index for quick member checks
CREATE INDEX idx_guild_members_user ON guild_members(user_id);

-- 6. Friends Table
CREATE TABLE friends (
    user_id_1 BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    user_id_2 BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status SMALLINT DEFAULT 0, -- 0:申請中, 1:已確認, 2:封鎖
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id_1, user_id_2),
    CONSTRAINT chk_friend_order CHECK (user_id_1 < user_id_2) -- Ensure unique pairs
);

-- 7. World Boss Table
CREATE TABLE world_boss (
    boss_id INT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    max_hp DOUBLE PRECISION NOT NULL,
    current_hp DOUBLE PRECISION NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_spawned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert Initial World Boss instance
INSERT INTO world_boss (boss_id, name, max_hp, current_hp, is_active)
VALUES (1, '奧米加獸殘影 (World Raid Boss)', 100000000.0, 100000000.0, TRUE)
ON CONFLICT (boss_id) DO NOTHING;
