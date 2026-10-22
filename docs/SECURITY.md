# Supabase Game：待確認的資料存取安全問題

檢測來源為 Game 專案目前實際資料庫，並非理論推測。

## Critical：以下六個公開資料表未開啟 RLS

- `public.guilds`
- `public.guild_members`
- `public.guild_applications`
- `public.friends`
- `public.challenges`
- `public.daily_quests`

這些資料表在 Supabase Data API 中可受到 anon／authenticated 角色的直接存取；沒有 RLS 就無法確保資料只由授權者讀寫。

**不能只執行下方六個 ALTER TABLE**：若沒有相容的 SELECT/INSERT/UPDATE/DELETE 權限政策，既有公會、好友、任務及聊天流程會失效。應先盤點現有應用流程、針對每個表建立最小權限政策及授權測試，再由管理者決定正式啟用時機。

```sql
-- 待完整政策測試通過之後，才應執行：
ALTER TABLE public.guilds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_quests ENABLE ROW LEVEL SECURITY;
```

## 其他作弊風險

- `users`：原政策允許使用者直接更新自己的 `gold`、`stamina` 等欄位。
- `monsters`：原政策允許使用者直接更新自己的攻防數值及對戰紀錄。
- `user_inventory`：原政策允許使用者直接更新自己的道具數量。
- `raid_boss`：原政策允許任何登入使用者更新世界王血量。
- `messages`：原政策容許直接寫入訊息，可能繞過 RPC 限速。

這些是原有 RLS 權限模型的問題，不能只靠前端的正確交易呼叫解決。若要變成可信任的多人競技遊戲，需要限制直寫、由安全的後端統一計算結果，同時確保舊使用者資料遷移相容。

參考：[Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
