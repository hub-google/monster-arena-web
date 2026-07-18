# 五、 技術規格與資料庫 Schema 設計 (Database Design)

為了實現註冊、多隻怪獸儲存、以及即時互動，後端必須使用高可用性的關係型資料庫，並設定嚴謹的主鍵/外鍵關聯。

## 5.1 關聯架構圖

### 概念關聯圖 (ERD Concept)
```
[Users Table] (1) <─────── (N) [Monsters Table] (1) <─── (N) [Breeding Records Table]
      │                                                           │
      ├─────── (N) [Guild Members] (N) ───────> [Guilds Table] (1) ┘
      │
      └─────── (N) [User Inventory Table]
```

### 詳細實體關係圖 (Entity Relationship Diagram)
```mermaid
erDiagram
    users {
        VARCHAR user_id PK "使用者ID (Firebase UID)"
        VARCHAR username UK "使用者帳號名稱"
        VARCHAR email UK "電子郵件"
        INT gold "持有金幣數量"
        INT premium_gems "付費寶石數量"
        INT stamina "目前體力值"
        INT max_stamina "最大體力值"
        DATETIME last_login_at "最後登入時間"
        DATETIME stamina_updated_at "體力最後恢復時間"
    }
    monsters {
        VARCHAR monster_id PK "怪獸ID"
        VARCHAR user_id FK "擁有者ID"
        VARCHAR parent_1_id FK "父母1 ID"
        VARCHAR parent_2_id FK "父母2 ID"
        VARCHAR name "怪獸名稱 (種族預設名稱)"
        VARCHAR custom_name "怪獸自訂名稱"
        INT generation "繁衍代數"
        TINYINT type "屬性 (1=疫苗, 2=資料, 3=病毒)"
        TINYINT family "種族/家族 (1~8)"
        TINYINT life_stage "生命階段 (1=蛋, 2=幼年, 3=成長, 4=成熟, 5=完全, 6=究極)"
        DOUBLE age_days "年齡 (天數)"
        DOUBLE fullness "飽足感 (0-100)"
        INT cleanliness "清潔度 (0-100)"
        BOOLEAN is_sick "是否生病"
        DATETIME sick_time_start "生病開始時間"
        DATETIME starve_time_start "飢餓開始時間"
        DATETIME dirty_time_start "髒污開始時間"
        DATETIME last_healed_at "最後治療時間"
        DATETIME sleep_until "睡眠狀態結束時間"
        BOOLEAN hunger_mistake_logged "是否已記錄飢餓疏忽"
        BOOLEAN sick_mistake_logged "是否已記錄生病疏忽"
        BOOLEAN poop_mistake_logged "是否已記錄大便疏忽"
        BOOLEAN sleep_poop_mistake_logged "是否已記錄睡眠大便疏忽"
        INT neglect_count "總疏忽次數"
        INT train_count "訓練次數"
        BOOLEAN is_dead "是否死亡"
        BOOLEAN is_frozen "是否處於靜止艙"
        VARCHAR death_reason "死亡原因"
        DOUBLE iv "個體值 (IV)"
        ARRAY traits "特徵標籤 (Traits)"
        DOUBLE gene_hp "基因生命值 (個體值)"
        DOUBLE gene_atk "基因攻擊力 (個體值)"
        DOUBLE gene_def "基因防禦力 (個體值)"
        DOUBLE gene_spd "基因速度 (個體值)"
        DOUBLE combat_hp "戰鬥生命值 (含訓練與衰退加成)"
        DOUBLE combat_atk "戰鬥攻擊力 (含訓練與衰退加成)"
        DOUBLE combat_def "戰鬥防禦力 (含訓練與衰退加成)"
        DOUBLE combat_spd "戰鬥速度 (含訓練與衰退加成)"
        VARCHAR chip_slot_1 "晶片插槽1"
        DOUBLE chip_slot_1_val "晶片插槽1數值"
        VARCHAR chip_slot_2 "晶片插槽2"
        DOUBLE chip_slot_2_val "晶片插槽2數值"
        INT battles "戰鬥總場次"
        INT wins "戰鬥勝利場次"
        BOOLEAN is_locked "是否鎖定 (防止放生)"
        DATETIME created_at "建立時間"
        DATETIME last_updated_at "最後更新時間"
    }
    user_inventory {
        VARCHAR inventory_id PK "庫存ID"
        VARCHAR user_id FK "使用者ID"
        TINYINT item_type "道具類型"
        VARCHAR item_id "道具ID (例如：meat_basic, medicine_standard)"
        INT quantity "持有數量"
    }
    guilds {
        VARCHAR guild_id PK "公會ID"
        VARCHAR guild_name UK "公會名稱"
        VARCHAR leader_id FK "會長ID"
        INT level "公會等級"
        INT total_contribution "公會總貢獻度"
        DATETIME created_at "建立時間"
    }
    guild_members {
        VARCHAR member_id PK "公會成員紀錄ID"
        VARCHAR guild_id FK "公會ID"
        VARCHAR user_id FK "使用者ID"
        TINYINT role "公會職位 (1=會長, 2=副會長, 0=成員)"
        INT contribution "個人對公會的貢獻度"
    }
    guild_applications {
        VARCHAR application_id PK "申請紀錄ID"
        VARCHAR guild_id FK "公會ID"
        VARCHAR user_id FK "申請者ID"
        DATETIME created_at "申請時間"
    }
    friends {
        VARCHAR friend_record_id PK "好友紀錄ID"
        VARCHAR user_id FK "發起者ID"
        VARCHAR friend_uid FK "目標UID"
        VARCHAR friend_name "目標名稱(已棄用/可選)"
        INT status "狀態 (0=待審核, 1=已同意)"
        DATETIME created_at "建立時間"
    }
    messages {
        VARCHAR message_id PK "訊息ID"
        VARCHAR channel "頻道(world, guild_id, private_id)"
        VARCHAR user_id FK "發送者ID"
        VARCHAR username "發送時的暱稱(可做備用)"
        TEXT text "訊息內容"
        DATETIME timestamp "發送時間"
    }
    challenges {
        VARCHAR challenge_id PK "對戰挑戰ID"
        VARCHAR challenger_uid FK "挑戰者ID"
        VARCHAR challenger_name "挑戰者名稱"
        VARCHAR target_uid FK "被挑戰者ID"
        VARCHAR status "狀態 (pending, accepted, declined)"
        JSON monster_data "挑戰者的怪獸資料"
        JSON target_monster "被挑戰者的怪獸資料"
        DATETIME created_at "發起時間"
    }
    daily_quests {
        VARCHAR quest_id PK "任務紀錄ID (UID_Date)"
        VARCHAR user_id FK "使用者ID"
        VARCHAR date "任務日期"
        INT feed_count "餵食次數"
        INT train_count "訓練次數"
        INT battle_count "戰鬥次數"
        ARRAY claimed "已領取獎勵的任務ID"
    }

    users ||--o{ monsters : "owns"
    users ||--o{ user_inventory : "has"
    users ||--o{ guild_members : "joins"
    users ||--o{ guild_applications : "applies"
    guilds ||--o{ guild_members : "contains"
    guilds ||--o{ guild_applications : "receives"
    users ||--o{ friends : "has friends"
    users ||--o{ messages : "sends"
    users ||--o{ challenges : "sends/receives"
    users ||--o{ daily_quests : "tracks"
```

## 5.2 核心資料表 (Database Tables)

*參考原有系統需求書內容建立，主要包含 `users`, `monsters`, `user_inventory`, `guilds`, `friends` 結構。*

## 5.3 遊戲邏輯與 UI 顯示規格

### 1. 怪獸進化條件與圖鑑顯示
圖鑑介面中，每一隻怪獸除了顯示屬性與外觀，皆需附帶該階段至下一階段的「進化條件說明」，並在養成面板 (Dashboard) 即時顯示當下的**培育參數**（包含：培育失誤次數、訓練次數、戰鬥勝率），以利玩家隨時掌握進化路線。

* **幼年期**：孵化後即進入幼年期。
* **成長期**：12小時後隨機進化。
* **成熟期** (48小時後)：
  * 疫苗種：訓練≥15次，培育失誤≤2次。
  * 資料種：訓練≥5次，培育失誤≤5次。
  * 病毒種：未達上述條件。
* **完全體** (96小時後)：
  * 疫苗種：戰鬥≥30場，勝率≥60%，培育失誤≤3次。
  * 資料種：戰鬥≥15場，勝率≥40%，培育失誤≤6次。
  * 病毒種：未達上述條件。
* **究極體** (7天後)：
  * 需達成 50 戰與 70% 勝率，並消耗道具「究極進化核心」。

### 2. 系統字串中文化對照
凡是 API 回傳或介面顯示的道具 ID 或數值欄位，均必須轉換為在地化中文，避免讓玩家看到生硬的系統變數名稱：
* `chip_spd` -> `速度晶片`，對應數值 `combat_spd` -> `戰鬥速度`
* `chip_atk` -> `攻擊晶片`，對應數值 `combat_atk` -> `戰鬥攻擊`
* `chip_def` -> `防禦晶片`，對應數值 `combat_def` -> `戰鬥防禦`
* `chip_hp`  -> `生命晶片`，對應數值 `combat_hp`  -> `戰鬥生命`
* `meat_basic` -> `普通肉塊`
* `medicine_standard` -> `標準特效藥`
* 等等...
