import { authApi } from './api/auth';
import { monstersApi } from './api/monsters';
import { inventoryApi } from './api/inventory';
import { questsApi } from './api/quests';
import { friendsApi } from './api/friends';
import { pvpApi } from './api/pvp';
import { guildApi } from './api/guild';
import { raidApi } from './api/raid';
import { socialApi } from './api/social';
import { pveApi } from './api/pve';
import { profileApi } from './api/profile';

export const api = {
  ...authApi,
  ...monstersApi,
  ...inventoryApi,
  ...questsApi,
  ...friendsApi,
  ...pvpApi,
  ...guildApi,
  ...raidApi,
  ...socialApi,
  ...pveApi,
  ...profileApi,
};
