import {
  loadGameConfig,
  loadPlayerData,
  savePlayerData,
} from "./dataManager.js";
import { getGlobalPrefix } from "../../service.js";
import { sendMessageFromSQL } from "../../chat-zalo/chat-style/chat-style.js";
import { isAdmin } from "../../../index.js";
import { checkBeforeJoinGame } from "../index.js";
import fs from "fs";
import path from "path";

const config = loadGameConfig();

const teamDataPath = path.join(
  process.cwd(),
  "src",
  "Nqduan-service",
  "game-service",
  "fishing",
  "data",
  "team_data.json",
);
function loadTeamData() {
  try {
    if (!fs.existsSync(teamDataPath)) {
      const dir = path.dirname(teamDataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(teamDataPath, "{}");
      return {};
    }
    const data = fs.readFileSync(teamDataPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Lỗi khi tải dữ liệu team:", error);
    return {};
  }
}
function saveTeamData(data) {
  try {
    fs.writeFileSync(teamDataPath, JSON.stringify(data, null, 4));
  } catch (error) {
    console.error("Lỗi khi lưu dữ liệu team:", error);
  }
}
const TEAM_CONFIG = { maxMembers: 5, creationCost: 5000 };
const thuyquaiStatePath = path.join(
  process.cwd(),
  "src",
  "Nqduan-service",
  "game-service",
  "fishing",
  "data",
  "monster_state.json",
);
const schedulePath = path.join(
  process.cwd(),
  "src",
  "Nqduan-service",
  "game-service",
  "fishing",
  "data",
  "schedule.json",
);
const THUYQUAI_CONFIG = [
  {
    id: "mq01",
    name: "Cá Sấu Cổ Đại",
    hp: 30000,
    rewards: { coins: 20000, baits: { bait_legendary: 30 } },
    teamReward: { coins: 10000, baits: { bait_special: 10 } },
    uniqueDrops: [
      { name: "Da Cá Sấu Cổ Đại", chance: 0.8 },
      { name: "Răng Nanh Hóa Thạch", chance: 0.5 },
    ],
  },
  {
    id: "mq02",
    name: "Rùa Quỷ Gai Lưng",
    hp: 50000,
    rewards: { coins: 35000, baits: { bait_legendary: 40 } },
    teamReward: { coins: 15000, baits: { bait_special: 20 } },
    uniqueDrops: [
      { name: "Mai Rùa Quỷ", chance: 0.7 },
      { name: "Ngọc Gai Biển Sâu", chance: 0.4 },
    ],
  },
  {
    id: "mq03",
    name: "Lươn Điện Khổng Lồ",
    hp: 10000,
    rewards: { coins: 60000, baits: { bait_legendary: 60 } },
    teamReward: { coins: 30000, baits: { bait_special: 30 } },
    uniqueDrops: [
      { name: "Lõi Năng Lượng Điện", chance: 0.6 },
      { name: "Vây Lươn Phát Sáng", chance: 0.3 },
    ],
  },
  {
    id: "mq04",
    name: "Kraken Con",
    hp: 200000,
    rewards: { coins: 150000, baits: { bait_legendary: 100 } },
    teamReward: { coins: 75000, baits: { bait_legendary: 50 } },
    uniqueDrops: [
      { name: "Xúc Tu Kraken", chance: 0.5 },
      { name: "Mắt Biển Khơi", chance: 0.2 },
    ],
  },
  {
    id: "mq05",
    name: "Cá Mập Megalodon",
    hp: 30000,
    rewards: { coins: 200000, baits: { bait_legendary: 150 } },
    teamReward: { coins: 100000, baits: { bait_legendary: 75 } },
    uniqueDrops: [
      { name: "Vây Cá Mập", chance: 0.6 },
      { name: "Răng Nanh", chance: 0.2 },
    ],
  },
];
function loadMonsterState() {
  if (!fs.existsSync(thuyquaiStatePath)) return { activeMonster: null };
  return JSON.parse(fs.readFileSync(thuyquaiStatePath, "utf-8"));
}
function saveMonsterState(data) {
  fs.writeFileSync(thuyquaiStatePath, JSON.stringify(data, null, 4));
}
function loadSchedule() {
  if (!fs.existsSync(schedulePath)) return { times: [] };
  return JSON.parse(fs.readFileSync(schedulePath, "utf-8"));
}
function saveSchedule(data) {
  fs.writeFileSync(schedulePath, JSON.stringify(data, null, 4));
}
const DIEMDANH_REWARDS = [
  { coins: 100, baits: { bait_earthworm: 5 } },
  { coins: 200, baits: { bait_earthworm: 6 } },
  { coins: 300, baits: { bait_earthworm: 7 } },
  { coins: 400, baits: { bait_earthworm: 8 } },
  { coins: 500, baits: { bait_earthworm: 9 } },
  { coins: 600, baits: { bait_earthworm: 10 } },
  { coins: 5000, baits: { bait_special: 30 } },
  { coins: 1500, baits: { bait_earthworm: 15 } },
  { coins: 1600, baits: { bait_earthworm: 16 } },
  { coins: 1700, baits: { bait_earthworm: 17 } },
  { coins: 1800, baits: { bait_earthworm: 18 } },
  { coins: 1900, baits: { bait_earthworm: 19 } },
  { coins: 2000, baits: { bait_earthworm: 20 } },
  { coins: 10000, baits: { bait_special: 50 } },
  { coins: 10000, baits: { bait_special: 50 } },
  { coins: 11000, baits: { bait_special: 50 } },
  { coins: 12000, baits: { bait_special: 50 } },
  { coins: 13000, baits: { bait_special: 50 } },
  { coins: 14000, baits: { bait_special: 50 } },
  { coins: 15000, baits: { bait_special: 50 } },
  { coins: 30000, baits: { bait_special: 100 } },
  { coins: 32000, baits: { bait_special: 105 } },
  { coins: 34000, baits: { bait_special: 110 } },
  { coins: 36000, baits: { bait_special: 115 } },
  { coins: 38000, baits: { bait_special: 120 } },
  { coins: 40000, baits: { bait_special: 125 } },
  { coins: 42000, baits: { bait_special: 130 } },
  { coins: 44000, baits: { bait_special: 135 } },
  { coins: 46000, baits: { bait_special: 140 } },
  { coins: 100000, baits: { bait_special: 5000 } },
];
const fishRarityMap = {};
const fishValueMap = {};
config.areas.forEach((area) => {
  if (area.fishNames) {
    Object.entries(area.fishNames).forEach(([rarity, names]) => {
      names.forEach((name) => {
        fishRarityMap[name] = rarity;
        const fishInfo = area.fish.find((f) => f.type === rarity);
        if (fishInfo) fishValueMap[name] = fishInfo.value;
      });
    });
  }
});
fishRarityMap["Rác"] = "junk";
fishValueMap["Rác"] = 1;

function checkAndAssignQuests(player) {
  if (!player.quests) return;
  const mainQuestData = player.quests.main;

  mainQuestData.activeQuests = mainQuestData.activeQuests.filter(
    (q) => !q.completed,
  );

  const questsNeeded = 5 - mainQuestData.activeQuests.length;

  if (
    questsNeeded > 0 &&
    mainQuestData.lastQuestIndex < config.quests.mainQuestline.length
  ) {
    const questsToAdd = config.quests.mainQuestline.slice(
      mainQuestData.lastQuestIndex,
      mainQuestData.lastQuestIndex + questsNeeded,
    );

    questsToAdd.forEach((questConfig) => {
      if (!questConfig.minLevel || player.level >= questConfig.minLevel) {
        if (
          !mainQuestData.activeQuests.some(
            (aq) => aq.questId === questConfig.id,
          )
        ) {
          const newQuestData = {
            questId: questConfig.id,
            progress: 0,
            completed: false,
          };

          // === LOGIC MỚI: KIỂM TRA TRƯỚC TIẾN ĐỘ ===
          const cumulativeTypes = {
            catch_total: "stats.totalFishCaught",
            catch_total_rarity: `stats.${questConfig.target?.rarity}Caught`,
            use_gacha_total: "stats.gachaSpins",
            repair_rod_total: "stats.repairsMade",
            own_item_count: "inventory.rods",
          };

          if (questConfig.type === "reach_level") {
            newQuestData.progress = player.level;
          } else if (cumulativeTypes[questConfig.type]) {
            const statPath = cumulativeTypes[questConfig.type];
            if (questConfig.type === "own_item_count") {
              const itemArray =
                statPath.split(".").reduce((o, i) => o?.[i], player) || [];
              newQuestData.progress = itemArray.length;
            } else {
              newQuestData.progress =
                statPath.split(".").reduce((o, i) => o?.[i], player) || 0;
            }
          }
          // ===========================================

          mainQuestData.activeQuests.push(newQuestData);
        }
      }
    });
    mainQuestData.lastQuestIndex += questsToAdd.length;
  }
}

function updateQuestProgress(player, actionType, value, params = {}) {
  const completedQuests = [];
  if (!player.quests || !player.quests.main || !player.quests.main.activeQuests)
    return completedQuests;

  player.quests.main.activeQuests.forEach((activeQuestData) => {
    if (activeQuestData.completed) return;

    const questConfig = config.quests.mainQuestline.find(
      (q) => q.id === activeQuestData.questId,
    );
    if (!questConfig) return;

    const cumulativeTypes = {
      catch_total: "stats.totalFishCaught",
      catch_total_rarity: `stats.${questConfig.target?.rarity}Caught`,
      use_gacha_total: "stats.gachaSpins",
      repair_rod_total: "stats.repairsMade",
      own_item_count: "inventory.rods",
    };

    const questType = questConfig.type;
    let progressUpdated = false;
    let currentProgress = activeQuestData.progress || 0;

    if (questType === actionType || cumulativeTypes[questType] === actionType) {
      let conditionsMet = true;
      if (questConfig.target) {
        for (const key in questConfig.target) {
          if (questConfig.target[key] === "any") continue;
          if (
            key === "itemType" &&
            params.itemType !== questConfig.target.itemType
          ) {
            conditionsMet = false;
            break;
          }
          if (
            key !== "itemType" &&
            String(params[key] || "") !== String(questConfig.target[key])
          ) {
            conditionsMet = false;
            break;
          }
        }
      }

      if (conditionsMet) {
        if (cumulativeTypes[questType]) {
          const statPath = cumulativeTypes[questType];
          if (questType === "own_item_count") {
            const itemArray =
              statPath.split(".").reduce((o, i) => o?.[i], player) || [];
            currentProgress = itemArray.length;
          } else {
            currentProgress =
              statPath.split(".").reduce((o, i) => o?.[i], player) || 0;
          }
        } else if (questType === "reach_level") {
          currentProgress = player.level;
        } else {
          currentProgress = (activeQuestData.progress || 0) + value;
        }
        activeQuestData.progress = currentProgress;
        progressUpdated = true;
      }
    }

    if (progressUpdated && currentProgress >= questConfig.goal) {
      activeQuestData.completed = true;
      const { rewards } = questConfig;
      if (rewards) {
        if (rewards.coins) player.money += rewards.coins;
        if (rewards.exp) player.exp += rewards.exp;
        if (rewards.gachaTickets)
          player.inventory.gachaTickets =
            (player.inventory.gachaTickets || 0) + rewards.gachaTickets;
        if (rewards.baits) {
          for (const baitId in rewards.baits) {
            player.inventory.baits[baitId] =
              (player.inventory.baits[baitId] || 0) + rewards.baits[baitId];
          }
        }
        if (rewards.consumables) {
          for (const consumableId in rewards.consumables) {
            player.inventory.consumables[consumableId] =
              (player.inventory.consumables[consumableId] || 0) +
              rewards.consumables[consumableId];
          }
        }
      }
      completedQuests.push(questConfig);
    }
  });

  return completedQuests;
}

function buildQuestCompletionMessage(completedQuests) {
  if (!completedQuests || completedQuests.length === 0) {
    return "";
  }
  let message = "";
  completedQuests.forEach((q) => {
    message += `\n\n✅ NHIỆM VỤ HOÀN THÀNH: ${q.title}\n`;

    let rewardLines = [];
    const { rewards } = q;
    if (rewards) {
      if (rewards.coins)
        rewardLines.push(`💰 +${rewards.coins.toLocaleString("en-US")} coins`);
      if (rewards.exp)
        rewardLines.push(`⭐ +${rewards.exp.toLocaleString("en-US")} EXP`);
      if (rewards.gachaTickets)
        rewardLines.push(`🎟️ +${rewards.gachaTickets} Vé Quay`);
      if (rewards.baits) {
        for (const baitId in rewards.baits) {
          const baitInfo = getItem(baitId);
          rewardLines.push(
            `🪱 +${rewards.baits[baitId]} ${baitInfo ? baitInfo.name : "Mồi"}`,
          );
        }
      }
      if (rewards.consumables) {
        for (const consumableId in rewards.consumables) {
          const itemInfo = getItem(consumableId);
          rewardLines.push(
            `🔧 +${rewards.consumables[consumableId]} ${itemInfo ? itemInfo.name : "Vật phẩm"}`,
          );
        }
      }
    }

    if (rewardLines.length > 0) {
      message += `🎁 Phần thưởng:\n   - ${rewardLines.join("\n   - ")}`;
    }
  });
  return message;
}

function createNewPlayer(userId, userName) {
  const startingRodConfig = getItem("rod_wood");
  return {
    userId: userId,
    name: userName,
    level: 1,
    exp: 0,
    expToNextLevel: 100,
    money: config.settings.startingMoney,
    teamId: null,
    currentArea: 1,
    equipment: { rod: "rod_wood", bait: "bait_earthworm" },
    inventory: {
      fish: {},
      rods: [
        {
          id: "rod_wood",
          currentDurability: startingRodConfig.effects.maxDurability,
          castsSinceLoss: 0,
        },
      ],
      baits: { bait_earthworm: 10 },
      tools: [],
      materials: {},
      consumables: {},
      gachaTickets: 0,
      mapsDiscovered: [1],
    },
    stats: {
      totalFishCaught: 0,
      junkCaught: 0,
      commonCaught: 0,
      rareCaught: 0,
      legendaryCaught: 0,
      mythicalCaught: 0,
      gachaSpins: 0,
      repairsMade: 0,
    },
    cooldowns: { cast: 0, attack: 0 },
    achievements: {},
    lastDiemDanh: 0,
    diemDanhStreak: 0,
    quests: {
      main: { lastQuestIndex: 0, activeQuests: [] },
    },
  };
}

function getItem(itemId) {
  return config.shopItems.find((item) => item.id === itemId);
}

function checkAndAwardAchievements(player) {
  const unlockedAchievements = [];
  if (!config.achievements) return unlockedAchievements;

  config.achievements.forEach((ach) => {
    if (!player.achievements[ach.id]?.claimed) {
      let playerStat;
      if (ach.checkType === "arrayLength") {
        const playerArray = ach.type
          .split(".")
          .reduce((o, i) => (o ? o[i] : undefined), player);
        playerStat = playerArray ? playerArray.length : 0;
      } else {
        playerStat = ach.type
          .split(".")
          .reduce((o, i) => (o ? o[i] : undefined), player);
      }
      if (playerStat !== undefined && playerStat >= ach.goal) {
        if (ach.rewards.coins) player.money += ach.rewards.coins;
        if (ach.rewards.exp) player.exp += ach.rewards.exp;
        if (ach.rewards.baits) {
          for (const baitId in ach.rewards.baits) {
            player.inventory.baits[baitId] =
              (player.inventory.baits[baitId] || 0) + ach.rewards.baits[baitId];
          }
        }
        if (ach.rewards.gachaTickets) {
          player.inventory.gachaTickets =
            (player.inventory.gachaTickets || 0) + ach.rewards.gachaTickets;
        }
        player.achievements[ach.id] = { claimed: true, date: Date.now() };
        unlockedAchievements.push(ach);
      }
    }
  });
  return unlockedAchievements;
}
function calculateScore(player) {
  if (!player || !player.stats) return 0;
  return (
    (player.exp || 0) +
    Math.floor((player.money || 0) / 5) +
    (player.stats.rareCaught || 0) * 150 +
    (player.stats.legendaryCaught || 0) * 500 +
    (player.stats.mythicalCaught || 0) * 2000
  );
}
async function getPlayerName(api, userId) {
  try {
    const userInfoResponse = await api.getUserInfo(userId);
    const userInfo =
      userInfoResponse?.unchanged_profiles?.[userId] ||
      userInfoResponse?.changed_profiles?.[userId];
    return userInfo?.zaloName || null;
  } catch (error) {
    return null;
  }
}

export async function handleFishingCommand(api, message, groupSettings) {
  try {
    const schedule = loadSchedule();
    const monsterState = loadMonsterState();
    if (schedule.times.length > 0 && !monsterState.activeMonster) {
      const now = new Date();
      const currentTime =
        now.getHours().toString().padStart(2, "0") +
        ":" +
        now.getMinutes().toString().padStart(2, "0");
      if (schedule.times.includes(currentTime)) {
        schedule.times = schedule.times.filter((t) => t !== currentTime);
        saveSchedule(schedule);
        const monsterConfig =
          THUYQUAI_CONFIG[Math.floor(Math.random() * THUYQUAI_CONFIG.length)];
        monsterState.activeMonster = {
          ...monsterConfig,
          currentHp: monsterConfig.hp,
          attackers: {},
        };
        saveMonsterState(monsterState);
        const announcement = `🌊 GÀO THÉT!!!\n\nMột con ${monsterState.activeMonster.name} hung dữ đã xuất hiện! HP: ${monsterState.activeMonster.currentHp.toLocaleString("en-US")}\n\nDùng "${getGlobalPrefix()}fishing thuyquai" để tấn công!`;
        await api.sendMessage(
          { msg: announcement },
          message.threadId,
          message.type,
        );
      }
    }
  } catch (e) {
    console.error("Lỗi bộ lập lịch Thủy Quái:", e);
  }

  if (!(await checkBeforeJoinGame(api, message, groupSettings))) return;

  const userId = message.data.uidFrom;
  const contentParts = message.data.content.trim().split(/\s+/);
  const subcommand = contentParts[1] ? contentParts[1].toLowerCase() : "help";
  const args = contentParts.slice(2);

  const allPlayers = loadPlayerData();
  let player = allPlayers[userId];

  const realUserName =
    (await getPlayerName(api, userId)) || `Người chơi #${userId.slice(-6)}`;

  if (!player) {
    player = createNewPlayer(userId, realUserName);
    allPlayers[userId] = player;
  }

  if (!player.inventory.consumables) player.inventory.consumables = {};
  if (player.inventory.gachaTickets === undefined)
    player.inventory.gachaTickets = 0;
  if (!player.inventory.mapsDiscovered) player.inventory.mapsDiscovered = [1];
  if (!player.stats.gachaSpins) player.stats.gachaSpins = 0;
  if (!player.stats.repairsMade) player.stats.repairsMade = 0;
  if (!player.quests || !player.quests.main.activeQuests) {
    player.quests = {
      main: {
        lastQuestIndex: player.quests?.main.questIndex || 0,
        activeQuests: [],
      },
    };
  }
  if (
    player.inventory.rods &&
    player.inventory.rods.length > 0 &&
    typeof player.inventory.rods[0] === "string"
  ) {
    player.inventory.rods = player.inventory.rods
      .map((rodId) => {
        const rodConfig = getItem(rodId);
        if (rodConfig && rodConfig.effects) {
          return {
            id: rodId,
            currentDurability: rodConfig.effects.maxDurability,
            castsSinceLoss: 0,
          };
        }
        return null;
      })
      .filter((r) => r !== null);
  }
  const allTeams = loadTeamData();
  if (player.teamId && !allTeams[player.teamId]) {
    player.teamId = null;
  }
  if (player.name !== realUserName) player.name = realUserName;
  if (player.lastDiemDanh === undefined) player.lastDiemDanh = 0;
  if (player.diemDanhStreak === undefined) player.diemDanhStreak = 0;
  if (!player.achievements) player.achievements = {};
  if (!player.equipment) player.equipment = { rod: "rod_wood", bait: null };
  if (!player.cooldowns) player.cooldowns = { cast: 0, attack: 0 };
  if (player.cooldowns.attack === undefined) player.cooldowns.attack = 0;
  if (!player.inventory.materials) player.inventory.materials = {};

  checkAndAssignQuests(player);

  const prefix = getGlobalPrefix();
  let responseText = `Lệnh không hợp lệ. Gõ \`${prefix}fishing help\` để xem hướng dẫn.`;
  let questCompletionText = "";

  switch (subcommand) {
    case "help": {
      responseText =
        `🎣 Hướng Dẫn Game Câu Cá 🎣\n\n` +
        `🔹 ${prefix}fishing cast: Quăng cần câu.\n` +
        `🔹 ${prefix}fishing diemdanh: Nhận quà hàng ngày.\n` +
        `🔹 ${prefix}fishing thuyquai: Tấn công Thủy Quái.\n` +
        `🔹 ${prefix}fishing random [sl|all]: Quay vé may mắn.\n` +
        `🔹 ${prefix}fishing npc: Xem nhiệm vụ.\n` +
        `🔹 ${prefix}fishing sell: Bán cá.\n` +
        `🔹 ${prefix}fishing map: Xem các khu vực.\n` +
        `🔹 ${prefix}fishing goto <số>: Di chuyển.\n` +
        `🔹 ${prefix}fishing rank: Xem bảng xếp hạng.\n` +
        `🔹 ${prefix}fishing inv: Kiểm tra túi đồ.\n` +
        `🔹 ${prefix}fishing team: Quản lý đội.\n` +
        `🔹 ${prefix}fishing achievements: Xem thành tựu.\n` +
        `🔹 ${prefix}fishing cần: Xem & trang bị cần.\n` +
        `🔹 ${prefix}fishing mồi: Xem & trang bị mồi.\n` +
        `🔹 ${prefix}fishing suachua <số>: Sửa cần câu.\n\n` +
        `🏪 Cửa Hàng:\n` +
        `🔹 ${prefix}fishing shop: Xem cửa hàng cần câu.\n` +
        `🔹 ${prefix}fishing buy <số>: Mua cần câu.\n` +
        `🔹 ${prefix}fishing shopitems: Xem cửa hàng vật phẩm.\n` +
        `🔹 ${prefix}fishing buyitems <số> [sl]: Mua vật phẩm.`;
      break;
    }

    case "npc": {
      responseText = "📜 BẢNG NHIỆM VỤ CHÍNH 📜\n\n";
      const mainQuestData = player.quests.main;

      if (
        !mainQuestData.activeQuests ||
        mainQuestData.activeQuests.length === 0
      ) {
        if (
          mainQuestData.lastQuestIndex >= config.quests.mainQuestline.length
        ) {
          responseText += `✅ Bạn đã hoàn thành tất cả nhiệm vụ chính!\n`;
        } else {
          responseText += `(Không có nhiệm vụ nào. Hãy câu cá hoặc lên cấp để nhận nhiệm vụ mới.)\n`;
        }
      } else {
        mainQuestData.activeQuests.forEach((activeQuest, index) => {
          const questConfig = config.quests.mainQuestline.find(
            (q) => q.id === activeQuest.questId,
          );
          if (questConfig) {
            let progress = activeQuest.progress || 0;
            const goal = questConfig.goal;

            const cumulativeTypes = {
              catch_total: "stats.totalFishCaught",
              catch_total_rarity: `stats.${questConfig.target?.rarity}Caught`,
              use_gacha_total: "stats.gachaSpins",
              repair_rod_total: "stats.repairsMade",
              own_item_count: "inventory.rods",
            };
            if (cumulativeTypes[questConfig.type]) {
              const statPath = cumulativeTypes[questConfig.type];
              if (questConfig.type === "own_item_count") {
                progress = (
                  statPath.split(".").reduce((o, i) => o?.[i], player) || []
                ).length;
              } else {
                progress =
                  statPath.split(".").reduce((o, i) => o?.[i], player) || 0;
              }
            }

            const progressPercent = Math.min(
              100,
              Math.floor((progress / goal) * 100),
            );

            responseText +=
              `${index + 1}. ${questConfig.title}\n` +
              `   - ${questConfig.description}\n` +
              `   - Tiến độ: ${progress.toLocaleString()}/${goal.toLocaleString()} (${progressPercent}%)\n\n`;
          }
        });
      }
      break;
    }

    case "diemdanh": {
      const now = Date.now();
      const lastDiemDanh = player.lastDiemDanh || 0;
      let currentStreak = player.diemDanhStreak || 0;
      const COOLDOWN = 24 * 60 * 60 * 1000;
      const STREAK_BREAK = 48 * 60 * 60 * 1000;
      const timeSinceLast = now - lastDiemDanh;
      if (lastDiemDanh !== 0 && timeSinceLast < COOLDOWN) {
        const timeLeft = COOLDOWN - timeSinceLast;
        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        responseText = `🕒 Bạn đã điểm danh rồi. Vui lòng quay lại sau ${hours} giờ ${minutes} phút.`;
        break;
      }
      if (lastDiemDanh === 0) {
        currentStreak = 1;
        responseText = "🎉 ĐIỂM DANH LẦN ĐẦU THÀNH CÔNG! 🎉\n\n";
      } else if (timeSinceLast > STREAK_BREAK) {
        currentStreak = 1;
        responseText =
          "❗ Chuỗi điểm danh đã bị reset do không điểm danh trong 48 giờ qua.\n\n";
      } else {
        currentStreak++;
        responseText = "🎉 ĐIỂM DANH THÀNH CÔNG! 🎉\n\n";
      }
      player.diemDanhStreak = currentStreak;
      const rewardDayIndex = Math.min(currentStreak, 30) - 1;
      const reward = DIEMDANH_REWARDS[rewardDayIndex];
      player.money += reward.coins;
      let rewardText = `🎁 Phần thưởng:\n- 💰 +${reward.coins.toLocaleString("en-US")} coins\n`;
      for (const baitId in reward.baits) {
        const amount = reward.baits[baitId];
        const baitInfo = getItem(baitId);
        player.inventory.baits[baitId] =
          (player.inventory.baits[baitId] || 0) + amount;
        rewardText += `- 🪱 +${amount} ${baitInfo ? baitInfo.name : baitId}\n`;
      }
      player.lastDiemDanh = now;
      responseText +=
        `🔥 Chuỗi điểm danh: ${currentStreak} ngày\n` + rewardText;

      const completedQuests = updateQuestProgress(
        player,
        "earn_coins",
        reward.coins,
      );
      if (completedQuests.length > 0) {
        questCompletionText = buildQuestCompletionMessage(completedQuests);
      }
      break;
    }

    case "thuyquai": {
      const monsterState = loadMonsterState();
      const action = args[0] ? args[0].toLowerCase() : "attack";

      if (["list", "trieuhoi", "random", "time"].includes(action)) {
        if (!isAdmin(userId)) {
          responseText = "⚠️ Lệnh này chỉ dành cho Quản trị viên.";
          break;
        }
        switch (action) {
          case "list":
            responseText = "📜 DANH SÁCH THỦY QUÁI 📜\n\n";
            THUYQUAI_CONFIG.forEach((m, i) => {
              responseText += `${i + 1}. ${m.name} (HP: ${m.hp.toLocaleString("en-US")})\n`;
            });
            break;
          case "trieuhoi":
          case "random":
            if (monsterState.activeMonster) {
              responseText = `⚠️ ${monsterState.activeMonster.name} vẫn còn sống!`;
              break;
            }
            let monsterConfig;
            if (action === "random") {
              monsterConfig =
                THUYQUAI_CONFIG[
                  Math.floor(Math.random() * THUYQUAI_CONFIG.length)
                ];
            } else {
              const index = parseInt(args[1]) - 1;
              if (isNaN(index) || !THUYQUAI_CONFIG[index]) {
                responseText = "⚠️ Số thứ tự không hợp lệ.";
                break;
              }
              monsterConfig = THUYQUAI_CONFIG[index];
            }
            monsterState.activeMonster = {
              ...monsterConfig,
              currentHp: monsterConfig.hp,
              attackers: {},
            };
            saveMonsterState(monsterState);
            responseText = `✅ Đã triệu hồi ${monsterConfig.name}!\n\n Dùng "${prefix}fishing thuyquai" để tấn công.`;
            break;
          case "time":
            const timeArgs = args.slice(1).join("").split(",");
            const schedule = loadSchedule();
            const validTimes = timeArgs.filter((t) =>
              /^([01]\d|2[0-3]):([0-5]\d)$/.test(t.trim()),
            );
            schedule.times = [...new Set([...schedule.times, ...validTimes])];
            saveSchedule(schedule);
            responseText = `✅ Đã cập nhật lịch triệu hồi: ${schedule.times.join(", ") || "Chưa có"}`;
            break;
        }
        break;
      }

      if (!monsterState.activeMonster) {
        responseText = "Hiện Tại Thủy Quái Chưa Xuất Hiện";
        break;
      }
      if (!player.teamId) {
        responseText =
          "⚠️ Bạn phải ở trong một team mới có thể tấn công Thủy Quái!";
        break;
      }
      const now = Date.now();
      const cooldown = 10 * 1000;
      if (now < (player.cooldowns.attack || 0)) {
        responseText = `⚔️ Tấn công lại sau ${Math.ceil(((player.cooldowns.attack || 0) - now) / 1000)}s.`;
        break;
      }
      player.cooldowns.attack = now + cooldown;
      const equippedRod = getItem(player.equipment.rod);
      let finalDamage = 0;
      if (
        equippedRod?.effects?.instantKillChance &&
        Math.random() < equippedRod.effects.instantKillChance
      ) {
        finalDamage = monsterState.activeMonster.currentHp;
        monsterState.activeMonster.currentHp = 0;
        responseText = `🔥🔥🔥 ${player.name} đã kích hoạt kỹ năng đặc biệt của ${equippedRod.name}, HẠ GỤC THỦY QUÁI NGAY LẬP TỨC!!!\n\n`;
      } else {
        const baseDamage = Math.floor(
          500 + player.level * 15 + Math.random() * 50,
        );
        let bonusDamage = 0;
        if (equippedRod?.effects?.monsterDamageBonus) {
          bonusDamage += equippedRod.effects.monsterDamageBonus;
        }
        player.inventory.tools.forEach((toolId) => {
          const tool = getItem(toolId);
          if (tool?.effects?.monsterDamageBonus) {
            bonusDamage += tool.effects.monsterDamageBonus;
          }
        });
        finalDamage = baseDamage + bonusDamage;
        monsterState.activeMonster.currentHp -= finalDamage;
        responseText =
          `⚔️ ${player.name} gây ${finalDamage.toLocaleString("en-US")} sát thương!\n` +
          `   HP còn lại của ${monsterState.activeMonster.name}: ${Math.max(0, monsterState.activeMonster.currentHp).toLocaleString("en-US")}`;
      }
      const attackers = monsterState.activeMonster.attackers || {};
      attackers[userId] = (attackers[userId] || 0) + finalDamage;
      monsterState.activeMonster.attackers = attackers;

      updateQuestProgress(player, "attack_monster", 1);

      if (monsterState.activeMonster.currentHp <= 0) {
        const monster = monsterState.activeMonster;
        const totalDamage = Object.values(attackers).reduce(
          (sum, dmg) => sum + dmg,
          0,
        );

        if (totalDamage === 0) {
          responseText = `💥 ${monster.name} đã bị hạ gục! 💥\n\nDo bị hạ gục quá nhanh, không thể tính toán xếp hạng sát thương.`;
          monsterState.activeMonster = null;
          saveMonsterState(monsterState);
          break;
        }

        let finalReport = `💥 ${monster.name} đã bị hạ gục! 💥\n`;

        const teamDamages = {};
        for (const uid in attackers) {
          const attackerPlayer = allPlayers[uid];
          if (attackerPlayer && attackerPlayer.teamId) {
            if (!teamDamages[attackerPlayer.teamId]) {
              teamDamages[attackerPlayer.teamId] = {
                totalDamage: 0,
              };
            }
            teamDamages[attackerPlayer.teamId].totalDamage += attackers[uid];
          }
        }
        const sortedTeams = Object.entries(teamDamages).sort(
          (a, b) => b[1].totalDamage - a[1].totalDamage,
        );

        let teamRankReport = "\n🏆 BXH SÁT THƯƠNG (TEAM) 🏆\n";
        sortedTeams.slice(0, 5).forEach(([teamId, data], index) => {
          const teamName = allTeams[teamId]?.name || "Team không xác định";
          teamRankReport += `${index + 1}. ${teamName}: ${data.totalDamage.toLocaleString("en-US")} (${((data.totalDamage / totalDamage) * 100).toFixed(2)}%)\n`;
        });
        finalReport += teamRankReport;

        let teamRewardReport = "";
        if (sortedTeams.length > 0) {
          const winningTeamId = sortedTeams[0][0];
          const winningTeam = allTeams[winningTeamId];

          if (winningTeam && winningTeam.name && monster.teamReward) {
            const members = winningTeam.members;
            if (members && members.length > 0) {
              const numMembers = members.length;
              const coinRewardPerMember = Math.floor(
                (monster.teamReward.coins || 0) / numMembers,
              );

              teamRewardReport += `\n🎉 TEAM VÔ ĐỊCH: ${winningTeam.name} 🎉\n`;
              let teamRewardDetails = [];
              if (monster.teamReward.coins > 0)
                teamRewardDetails.push(
                  `${monster.teamReward.coins.toLocaleString("en-US")} coins`,
                );

              let baitRewardTexts = [];
              for (const baitId in monster.teamReward.baits) {
                const baitInfo = getItem(baitId);
                if (baitInfo) {
                  // CHECK NẾU BAITINFO TỒN TẠI
                  baitRewardTexts.push(
                    `${monster.teamReward.baits[baitId]} ${baitInfo.name}`,
                  );
                }
              }
              if (baitRewardTexts.length > 0)
                teamRewardDetails.push(baitRewardTexts.join(", "));

              teamRewardReport += `🎁 Quà thưởng team: ${teamRewardDetails.join(" và ")}\n`;
              teamRewardReport += `Chia đều cho ${numMembers} thành viên, mỗi người nhận:\n`;

              let perMemberTexts = [];
              if (coinRewardPerMember > 0)
                perMemberTexts.push(
                  `${coinRewardPerMember.toLocaleString("en-US")} coins`,
                );

              members.forEach((member) => {
                const memberPlayer = allPlayers[member.userId];
                if (memberPlayer) {
                  memberPlayer.money += coinRewardPerMember;
                  for (const baitId in monster.teamReward.baits) {
                    const baitAmountPerMember = Math.floor(
                      monster.teamReward.baits[baitId] / numMembers,
                    );
                    if (baitAmountPerMember > 0) {
                      memberPlayer.inventory.baits[baitId] =
                        (memberPlayer.inventory.baits[baitId] || 0) +
                        baitAmountPerMember;
                      const baitInfo = getItem(baitId);
                      if (baitInfo) {
                        // CHECK NẾU BAITINFO TỒN TẠI
                        const text = `${baitAmountPerMember} ${baitInfo.name}`;
                        if (!perMemberTexts.includes(text))
                          perMemberTexts.push(text);
                      }
                    }
                  }
                }
              });
              teamRewardReport += `- ${perMemberTexts.join("\n- ")}\n`;
            }
          } else {
            teamRewardReport +=
              "\n\n🏆 Team gây sát thương cao nhất đã bị giải tán và không thể nhận thưởng.";
          }
        }
        finalReport += teamRewardReport;

        let individualRankReport = `\n👤 BXH SÁT THƯƠNG (CÁ NHÂN) 👤\n`;
        let individualRewardList = [];
        const sortedAttackers = Object.entries(attackers).sort(
          (a, b) => b[1] - a[1],
        );

        sortedAttackers.forEach(([uid, dmg], index) => {
          const playerToReward = allPlayers[uid];
          if (!playerToReward || !playerToReward.name) return;

          updateQuestProgress(playerToReward, "kill_monster", 1);

          const damagePercent = dmg / totalDamage;
          const coinReward = Math.floor(monster.rewards.coins * damagePercent);
          playerToReward.money += coinReward;

          let baitRewardsText = "";
          for (const baitId in monster.rewards.baits) {
            const baitAmount = Math.floor(
              monster.rewards.baits[baitId] * damagePercent,
            );
            if (baitAmount > 0) {
              playerToReward.inventory.baits[baitId] =
                (playerToReward.inventory.baits[baitId] || 0) + baitAmount;
              const baitInfo = getItem(baitId);
              if (baitInfo) {
                // CHECK NẾU BAITINFO TỒN TẠI
                baitRewardsText += `, +${baitAmount} ${baitInfo.name}`;
              }
            }
          }

          if (index < 5) {
            individualRankReport += `${index + 1}. ${playerToReward.name}: ${dmg.toLocaleString("en-US")} (${(damagePercent * 100).toFixed(2)}%)\n`;
          }

          individualRewardList.push(
            `- ${playerToReward.name}: +${coinReward.toLocaleString("en-US")} coins${baitRewardsText}`,
          );
        });
        finalReport += individualRankReport;
        finalReport +=
          "\n🎁 PHẦN THƯỞNG CÁ NHÂN:\n" + individualRewardList.join("\n");

        let uniqueDropsText = "";
        if (sortedAttackers.length > 0) {
          const topDamagerId = sortedAttackers[0][0];
          const topDamager = allPlayers[topDamagerId];
          if (topDamager && topDamager.name) {
            let hasUniqueDrop = false;
            let drops = [];
            monster.uniqueDrops.forEach((drop) => {
              if (Math.random() < drop.chance) {
                hasUniqueDrop = true;
                topDamager.inventory.materials[drop.name] =
                  (topDamager.inventory.materials[drop.name] || 0) + 1;
                drops.push(`1 ${drop.name}`);
              }
            });
            if (hasUniqueDrop) {
              uniqueDropsText += `\n✨ ${topDamager.name} (Top 1 Dame) nhận được: ${drops.join(", ")}!`;
            }
          }
        }
        finalReport += uniqueDropsText;

        responseText = finalReport;
        monsterState.activeMonster = null;
      }
      saveMonsterState(monsterState);
      break;
    }

    case "sell": {
      const sellType = args[0];
      if (!sellType) {
        responseText =
          `Hướng Dẫn Bán Cá\n\n` +
          `🔹 \`${prefix}fishing sell all\`\n_Bán tất cả cá trong túi đồ._\n\n` +
          `🔹 \`${prefix}fishing sell <tên cá>\`\n_Bán 1 con cá có tên chỉ định._\n_Ví dụ: ${prefix}fishing sell Cá Trắm_\n\n` +
          `🔹 \`${prefix}fishing sell <tên cá> <số lượng>\`\n_Bán số lượng cá chỉ định._\n_Ví dụ: ${prefix}fishing sell Cá Diếc 2_`;
        break;
      }
      let totalCoinsEarned = 0;
      let soldFishSummary = [];
      if (sellType.toLowerCase() === "all") {
        if (Object.keys(player.inventory.fish).length === 0) {
          responseText = "Túi đồ của bạn trống trơn, không có gì để bán!";
          break;
        }
        for (const fishName in player.inventory.fish) {
          const count = player.inventory.fish[fishName];
          const value = fishValueMap[fishName] || 0;
          totalCoinsEarned += count * value;
          soldFishSummary.push(`${fishName} x${count}`);
        }
        player.inventory.fish = {};
        responseText =
          `✅ Đã bán tất cả cá!\n\n` +
          `Danh sách: ${soldFishSummary.join(", ")}\n` +
          `💰 Bạn nhận được: ${totalCoinsEarned.toLocaleString("en-US")} coins.`;
      } else {
        const amountToSell = parseInt(args[args.length - 1]);
        let fishNameToSell;
        let sellCount = 1;
        if (!isNaN(amountToSell) && amountToSell > 0) {
          fishNameToSell = args.slice(0, -1).join(" ");
          sellCount = amountToSell;
        } else {
          fishNameToSell = args.join(" ");
        }
        const actualFishName = Object.keys(player.inventory.fish).find(
          (name) => name.toLowerCase() === fishNameToSell.toLowerCase(),
        );
        if (!actualFishName) {
          responseText = `⚠️ Không tìm thấy cá "${fishNameToSell}" trong túi đồ của bạn.`;
          break;
        }
        if (player.inventory.fish[actualFishName] < sellCount) {
          responseText = `⚠️ Bạn chỉ có ${player.inventory.fish[actualFishName]} con ${actualFishName}, không đủ để bán ${sellCount} con.`;
          break;
        }
        const value = fishValueMap[actualFishName] || 0;
        totalCoinsEarned = sellCount * value;
        player.inventory.fish[actualFishName] -= sellCount;
        if (player.inventory.fish[actualFishName] === 0) {
          delete player.inventory.fish[actualFishName];
        }
        responseText =
          `✅ Đã bán thành công ${sellCount} con ${actualFishName}.\n` +
          `💰 Bạn nhận được: ${totalCoinsEarned.toLocaleString("en-US")} coins.`;
      }
      player.money += totalCoinsEarned;

      const completedQuests = updateQuestProgress(
        player,
        "earn_coins",
        totalCoinsEarned,
      );
      if (completedQuests.length > 0) {
        questCompletionText = buildQuestCompletionMessage(completedQuests);
      }
      break;
    }

    case "rank":
    case "bxh": {
      const allRankedPlayers = Object.values(allPlayers)
        .map((p) => {
          p.score = calculateScore(p);
          return p;
        })
        .sort((a, b) => b.score - a.score);
      const rankEmojis = [
        "🥇",
        "🥈",
        "🥉",
        "4️⃣",
        "5️⃣",
        "6️⃣",
        "7️⃣",
        "8️⃣",
        "9️⃣",
        "🔟",
      ];
      let top10Verified = [];
      for (const p of allRankedPlayers) {
        if (top10Verified.length >= 10) break;
        const liveName = await getPlayerName(api, p.userId);
        if (liveName) {
          p.name = liveName;
          top10Verified.push(p);
        }
      }
      if (top10Verified.length === 0) {
        responseText = "Chưa có cao thủ nào!";
        break;
      }
      responseText = "🏆 BẢNG XẾP HẠNG CÂU CÁ\n\n";
      for (const [index, p] of top10Verified.entries()) {
        responseText +=
          `${rankEmojis[index]} ${p.name}\n` +
          `   🎯 Level: ${p.level || 1}\n` +
          `   💰 Coins: ${(p.money || 0).toLocaleString("en-US")}\n` +
          `   🐉 Huyền thoại: ${p.stats?.legendaryCaught || 0} | 🍣 Hiếm: ${p.stats?.rareCaught || 0}\n` +
          `   ⭐ Điểm: ${(p.score || 0).toLocaleString("en-US")}\n\n`;
      }
      const userRankIndex = allRankedPlayers.findIndex(
        (p) => p.userId === userId,
      );
      const userRank =
        userRankIndex !== -1 ? userRankIndex + 1 : "Chưa có hạng";
      responseText +=
        `👤 THÀNH TÍCH CỦA BẠN (${player.name}):\n` +
        `🏅 Hạng: ${userRank}\n` +
        `🎯 Level: ${player.level}\n` +
        `💰 Coins: ${player.money.toLocaleString("en-US")}\n` +
        `🐉 Huyền thoại: ${player.stats.legendaryCaught || 0} | 🍣 Hiếm: ${player.stats.rareCaught || 0}`;
      break;
    }

    case "shop": {
      const rods = config.shopItems.filter((item) => item.type === "rod");
      let shopDisplay = `🏪 CỬA HÀNG CẦN CÂU\n💰 Coins: ${player.money.toLocaleString("en-US")}\n\n`;
      rods.forEach((item, index) => {
        shopDisplay +=
          `\n${index + 1}. ${item.name} - ${item.price.toLocaleString("en-US")} coins\n` +
          `   ${item.description.replace(/\n/g, "\n   ")}\n`;
      });
      shopDisplay += `\n💡 Dùng ${prefix}fishing buy <số> để mua`;
      responseText = shopDisplay;
      break;
    }

    case "shopitems": {
      const items = config.shopItems.filter((item) => item.type !== "rod");
      let shopDisplay = `🏪 CỬA HÀNG VẬT PHẨM\n💰 Coins: ${player.money.toLocaleString("en-US")}\n\n`;
      items.forEach((item, index) => {
        shopDisplay +=
          `\n${index + 1}. ${item.name} - ${item.price.toLocaleString("en-US")} coins\n` +
          `   ${item.description.replace(/\n/g, "\n   ")}\n`;
      });
      shopDisplay += `\n💡 Dùng ${prefix}fishing buyitems <số> [sl] để mua`;
      responseText = shopDisplay;
      break;
    }

    case "buy": {
      const rods = config.shopItems.filter((item) => item.type === "rod");
      const itemIndex = parseInt(args[0]) - 1;

      if (isNaN(itemIndex) || itemIndex < 0 || itemIndex >= rods.length) {
        responseText = "⚠️ Số thứ tự cần câu không hợp lệ.";
        break;
      }

      const item = rods[itemIndex];
      const ownedRods = player.inventory.rods.map((r) => r.id);

      if (ownedRods.includes(item.id)) {
        responseText = `⚠️ Bạn đã sở hữu ${item.name} rồi.`;
        break;
      }
      if (player.money < item.price) {
        responseText = `⚠️ Bạn không đủ tiền. Cần ${item.price.toLocaleString("en-US")} coins.`;
        break;
      }

      player.money -= item.price;
      const rodConfig = getItem(item.id);
      player.inventory.rods.push({
        id: item.id,
        currentDurability: rodConfig.effects.maxDurability,
        castsSinceLoss: 0,
      });
      responseText = `✅ Bạn đã mua thành công ${item.name}!`;

      const completed = [];
      completed.push(
        ...updateQuestProgress(player, "own_item", 1, { itemId: item.id }),
      );
      completed.push(
        ...updateQuestProgress(player, "own_item_count", 1, {
          itemType: "rod",
        }),
      );

      if (completed.length > 0) {
        questCompletionText = buildQuestCompletionMessage(completed);
      }

      const rodMasterAch = config.achievements.find(
        (a) => a.id === "rod_master",
      );
      if (rodMasterAch) {
        const progress = Math.floor(
          (player.inventory.rods.length / rodMasterAch.goal) * 100,
        );
        responseText +=
          `\n\n✨ Bạn đã sở hữu một loại cần câu mới! ✨\n` +
          `Tiến độ thành tựu "Cần Thủ": ${player.inventory.rods.length}/${rodMasterAch.goal} (${progress}%)`;
      }
      responseText += `\nDùng "${prefix}fishing cần" để trang bị.`;
      break;
    }

    case "buyitems": {
      const items = config.shopItems.filter((item) => item.type !== "rod");
      const itemIndex = parseInt(args[0]) - 1;
      const quantity = parseInt(args[1]) || 1;

      if (isNaN(itemIndex) || itemIndex < 0 || itemIndex >= items.length) {
        responseText = "⚠️ Số thứ tự vật phẩm không hợp lệ.";
        break;
      }
      if (quantity <= 0) {
        responseText = "⚠️ Số lượng mua phải là số dương.";
        break;
      }

      const item = items[itemIndex];
      const totalCost = item.price * quantity;
      if (player.money < totalCost) {
        responseText = `⚠️ Không đủ tiền. Cần ${totalCost.toLocaleString("en-US")} coins.`;
        break;
      }

      player.money -= totalCost;

      if (item.type === "bait") {
        const totalUses = item.effects.uses * quantity;
        player.inventory.baits[item.id] =
          (player.inventory.baits[item.id] || 0) + totalUses;
        responseText =
          `✅ Mua thành công ${quantity} ${item.name}!\n` +
          `💰 Đã trừ: ${totalCost.toLocaleString("en-US")} coins.\n` +
          `🪱 Nhận được: ${totalUses} lượt dùng.`;
      } else if (item.type === "consumable") {
        player.inventory.consumables[item.id] =
          (player.inventory.consumables[item.id] || 0) + quantity;
        responseText = `✅ Mua thành công ${quantity} ${item.name}!`;
      } else if (item.type === "tool") {
        if (player.inventory.tools.includes(item.id)) {
          responseText = `⚠️ Bạn đã sở hữu ${item.name} rồi.`;
          player.money += totalCost;
          break;
        }
        if (quantity > 1) {
          responseText = `⚠️ Bạn chỉ có thể mua 1 ${item.name} mỗi lần.`;
          player.money += totalCost;
          break;
        }
        player.inventory.tools.push(item.id);
        responseText = `✅ Bạn đã mua thành công ${item.name}!`;
      } else {
        responseText = "⚠️ Không thể mua loại vật phẩm này.";
        player.money += totalCost;
      }
      break;
    }

    case "buff": {
      if (!isAdmin(userId)) {
        responseText = "⚠️ Lệnh này chỉ dành cho Admin.";
        break;
      }
      let targetId = userId,
        amount;
      let targetUser = message.data.mentions?.[0];
      if (targetUser) {
        targetId = targetUser.uid;
        amount = parseInt(args[args.length - 1]);
      } else {
        amount = parseInt(args[0]);
      }
      if (isNaN(amount) || amount <= 0) {
        responseText = `⚠️ Cú pháp không hợp lệ.`;
        break;
      }
      let targetPlayer = allPlayers[targetId];
      if (!targetPlayer) {
        responseText = `⚠️ Người chơi chưa tham gia game.`;
        break;
      }
      targetPlayer.money += amount;
      responseText = `✅ Đã buff thành công ${amount.toLocaleString("en-US")} coins.`;
      break;
    }

    case "inventory":
    case "inv": {
      responseText =
        `🎒 TÚI ĐỒ CỦA ${player.name.toUpperCase()} 🎒\n` +
        `💰 Coins: ${player.money.toLocaleString("en-US")}\n\n`;

      responseText += `🎟️ VÉ QUAY: ${player.inventory.gachaTickets || 0}\n\n`;

      responseText += `🎣 CẦN CÂU Sở Hữu:\n`;
      if (!player.inventory.rods || player.inventory.rods.length === 0) {
        responseText += `   (Trống)\n`;
      } else {
        player.inventory.rods.forEach((rodObj) => {
          const rodInfo = getItem(rodObj.id);
          if (rodInfo) {
            const durabilityInfo = `(Bền: ${rodObj.currentDurability}/${rodInfo.effects.maxDurability})`;
            responseText += `   - ${rodInfo.name} ${durabilityInfo}${player.equipment.rod === rodObj.id ? " (▶️ Đang trang bị)" : ""}\n`;
          }
        });
      }
      responseText += `\n`;
      const availableBaits = Object.entries(
        player.inventory.baits || {},
      ).filter(([id, count]) => count > 0);
      responseText += `🪱 MỒI CÂU Hiện Có:\n`;
      if (availableBaits.length === 0) {
        responseText += `   (Trống)\n`;
      } else {
        availableBaits.forEach(([baitId, count]) => {
          const baitInfo = getItem(baitId);
          if (baitInfo) {
            responseText += `   - ${baitInfo.name} (còn ${count} lượt)${player.equipment.bait === baitId ? " (▶️ Đang trang bị)" : ""}\n`;
          }
        });
      }
      responseText += `\n⚙️ VẬT PHẨM TIÊU HAO:\n`;
      const consumables = Object.entries(player.inventory.consumables || {});
      if (consumables.length === 0) {
        responseText += `   (Trống)\n`;
      } else {
        consumables.forEach(([itemId, count]) => {
          const itemInfo = getItem(itemId);
          if (itemInfo) responseText += `   - ${itemInfo.name} (x${count})\n`;
        });
      }
      responseText += `\n`;
      const materials = Object.entries(player.inventory.materials || {});
      if (materials.length > 0) {
        responseText += `✨ VẬT PHẨM & NGUYÊN LIỆU:\n`;
        materials.forEach(([name, count]) => {
          responseText += `   - ${name} (x${count})\n`;
        });
        responseText += `\n`;
      }
      responseText += `🐠 CÁ TRONG TÚI:\n`;
      const playerFish = Object.entries(player.inventory.fish);
      if (playerFish.length === 0) {
        responseText += "   (Trống)\n";
      } else {
        const categorizedFish = {
          mythical: [],
          legendary: [],
          rare: [],
          common: [],
          junk: [],
        };
        const rarityToIcon = {
          mythical: "🔱",
          legendary: "🐉",
          rare: "🍣",
          common: "🐟",
          junk: "👟",
        };
        const rarityToName = {
          mythical: "THẦN THOẠI",
          legendary: "HUYỀN THOẠI",
          rare: "HIẾM",
          common: "THƯỜNG",
          junk: "RÁC",
        };
        playerFish.forEach(([fishName, count]) => {
          const rarity = fishRarityMap[fishName] || "common";
          if (categorizedFish[rarity]) {
            categorizedFish[rarity].push(`   ${fishName} x${count}`);
          }
        });
        const fishDisplayParts = [];
        for (const rarity in categorizedFish) {
          if (categorizedFish[rarity].length > 0) {
            const categoryString =
              `${rarityToIcon[rarity]} ${rarityToName[rarity]}:\n` +
              `${categorizedFish[rarity].join("\n")}`;
            fishDisplayParts.push(categoryString);
          }
        }
        if (fishDisplayParts.length > 0) {
          responseText += fishDisplayParts.join("\n\n");
        } else {
          responseText += "   (Trống)\n";
        }
      }
      break;
    }

    case "cần":
    case "rod": {
      const itemToEquip = parseInt(args[0]) - 1;
      if (!isNaN(itemToEquip)) {
        if (itemToEquip >= 0 && itemToEquip < player.inventory.rods.length) {
          const rodId = player.inventory.rods[itemToEquip].id;
          player.equipment.rod = rodId;
          const rodInfo = getItem(rodId);
          responseText = `Đã trang bị ${rodInfo.name}.`;
        } else {
          responseText = "Số thứ tự không hợp lệ.";
        }
      } else {
        let rodList = player.inventory.rods
          .map((rodObj, index) => {
            const rodInfo = getItem(rodObj.id);
            const durabilityInfo = `(Bền: ${rodObj.currentDurability}/${rodInfo.effects.maxDurability})`;
            const isEquipped =
              player.equipment.rod === rodObj.id ? " (Đang trang bị)" : "";
            return `${index + 1}. ${rodInfo.name} ${durabilityInfo}${isEquipped}`;
          })
          .join("\n");
        responseText = `🎣 Cần Câu Của Bạn:\n${rodList}\n\nDùng ${prefix}fishing cần <số> để trang bị.`;
      }
      break;
    }

    case "mồi":
    case "bait": {
      const availableBaits = Object.keys(player.inventory.baits).filter(
        (id) => player.inventory.baits[id] > 0,
      );
      const itemIndex = parseInt(args[0]) - 1;
      if (!isNaN(itemIndex)) {
        if (itemIndex >= 0 && itemIndex < availableBaits.length) {
          const baitId = availableBaits[itemIndex];
          player.equipment.bait = baitId;
          const baitInfo = getItem(baitId);
          responseText = `Đã trang bị ${baitInfo.name}.`;
        } else {
          responseText = "⚠️ Số thứ tự không hợp lệ.";
        }
      } else {
        if (availableBaits.length === 0) {
          responseText = "🪱 Mồi Câu Của Bạn:\nBạn không có mồi nào.";
        } else {
          const baitList = availableBaits
            .map((baitId, index) => {
              const baitInfo = getItem(baitId);
              const isEquipped =
                player.equipment.bait === baitId ? " (▶️ Đang trang bị)" : "";
              return `${index + 1}. ${baitInfo.name} - Còn lại: ${player.inventory.baits[baitId]} lượt${isEquipped}`;
            })
            .join("\n");
          responseText = `🪱 Mồi Câu Của Bạn:\n${baitList}\n\nDùng ${prefix}fishing mồi <số> để trang bị.`;
        }
      }
      break;
    }

    case "map":
    case "area": {
      let mapList = "🗺️ BẢN ĐỒ CÁC KHU VỰC CÂU CÁ 🗺️\n\n";
      config.areas.forEach((area) => {
        const isCurrent =
          player.currentArea === area.id ? " (Bạn đang ở đây)" : "";
        mapList +=
          `${area.id}. ${area.name}${isCurrent}\n` +
          `   (Yêu cầu Level: ${area.levelRequired})\n`;
      });
      mapList += `\nDùng ${prefix}fishing goto <số> để di chuyển.`;
      responseText = mapList;
      break;
    }

    case "goto": {
      const areaId = parseInt(args[0]);
      const targetArea = config.areas.find((a) => a.id === areaId);
      if (!targetArea) {
        responseText = "⚠️ Khu vực không tồn tại.";
        break;
      }
      if (player.level < targetArea.levelRequired) {
        responseText = `⚠️ Bạn cần đạt Level ${targetArea.levelRequired}.`;
        break;
      }
      if (player.currentArea === targetArea.id) {
        responseText = `Bạn đã ở tại ${targetArea.name} rồi.`;
        break;
      }

      player.currentArea = targetArea.id;
      responseText = `✅ Đã di chuyển đến ${targetArea.name}!`;

      if (!player.inventory.mapsDiscovered.includes(targetArea.id)) {
        player.inventory.mapsDiscovered.push(targetArea.id);
        const fullMapAch = config.achievements.find(
          (a) => a.id === "full_map_player",
        );
        if (fullMapAch) {
          const progress = Math.floor(
            (player.inventory.mapsDiscovered.length / fullMapAch.goal) * 100,
          );
          responseText +=
            `\n\n🎉 Thành tựu Khám Phá! 🎉\n` +
            `Bạn đã đặt chân đến ${targetArea.name}\n` +
            `Tiến độ "Người Chơi Full Map": ${player.inventory.mapsDiscovered.length}/${fullMapAch.goal} (${progress}%)`;
        }
      }

      const completedQuests = updateQuestProgress(player, "goto", 1, {
        areaId: targetArea.id,
      });
      if (completedQuests.length > 0) {
        questCompletionText = buildQuestCompletionMessage(completedQuests);
      }
      break;
    }

    case "suachua": {
      const kitId = "repair_kit";
      const availableKits = player.inventory.consumables[kitId] || 0;
      if (availableKits <= 0) {
        responseText = `⚠️ Bạn không có "Bộ Sửa Chữa". Hãy mua ở cửa hàng!`;
        break;
      }

      const rodIndex = parseInt(args[0]) - 1;
      if (
        isNaN(rodIndex) ||
        rodIndex < 0 ||
        rodIndex >= player.inventory.rods.length
      ) {
        responseText = `⚠️ Số thứ tự cần câu không hợp lệ. Dùng "${prefix}fishing cần" để xem số thứ tự.`;
        break;
      }

      const rodToRepair = player.inventory.rods[rodIndex];
      const rodConfig = getItem(rodToRepair.id);
      const kitConfig = getItem(kitId);

      if (rodToRepair.currentDurability >= rodConfig.effects.maxDurability) {
        responseText = `✨ ${rodConfig.name} đã có độ bền tối đa.`;
        break;
      }

      const baseRepair = kitConfig.effects.baseRepairValue;
      const multiplier = rodConfig.effects.repairMultiplier || 1.0;
      const amountRepaired = Math.floor(baseRepair * multiplier);

      rodToRepair.currentDurability = Math.min(
        rodConfig.effects.maxDurability,
        rodToRepair.currentDurability + amountRepaired,
      );

      player.inventory.consumables[kitId]--;
      player.stats.repairsMade += 1;

      responseText =
        `🔧 Sửa chữa thành công!\n` +
        `- Tên cần: ${rodConfig.name}\n` +
        `- Độ bền đã phục hồi: +${amountRepaired}\n` +
        `- Độ bền hiện tại: ${rodToRepair.currentDurability}/${rodConfig.effects.maxDurability}\n\n` +
        `Còn lại ${player.inventory.consumables[kitId]} Bộ Sửa Chữa.`;

      const completedQuests = [
        ...updateQuestProgress(player, "repair_rod", 1),
        ...updateQuestProgress(player, "stats.repairsMade", 0),
      ];
      if (completedQuests.length > 0) {
        questCompletionText = buildQuestCompletionMessage(completedQuests);
      }
      break;
    }

    case "random": {
      let quantity = 1;
      const arg = args[0];
      const playerTickets = player.inventory.gachaTickets || 0;

      if (playerTickets <= 0) {
        responseText = "🎟️ Bạn không có Vé Quay nào để sử dụng.";
        break;
      }

      if (arg) {
        if (arg.toLowerCase() === "all") {
          quantity = playerTickets;
        } else {
          const num = parseInt(arg);
          if (isNaN(num) || num <= 0) {
            responseText =
              "⚠️ Số lượng không hợp lệ. Vui lòng nhập một số dương hoặc 'all'.";
            break;
          }
          if (num > playerTickets) {
            responseText = `⚠️ Bạn chỉ có ${playerTickets} vé, không đủ để quay ${num} lần.`;
            break;
          }
          quantity = num;
        }
      }

      player.inventory.gachaTickets -= quantity;
      player.stats.gachaSpins += quantity;

      const totalRewards = { coins: 0, exp: 0, baits: {}, rods: [] };
      let mythicalRodWon = 0;

      for (let i = 0; i < quantity; i++) {
        if (Math.random() < 0.005) {
          if (player.inventory.rods.map((r) => r.id).includes("rod_mythical")) {
            const consolationPrize = 50000;
            player.money += consolationPrize;
            totalRewards.coins += consolationPrize;
          } else {
            const rodConfig = getItem("rod_mythical");
            player.inventory.rods.push({
              id: "rod_mythical",
              currentDurability: rodConfig.effects.maxDurability,
              castsSinceLoss: 0,
            });
            totalRewards.rods.push(rodConfig.name);
            mythicalRodWon++;
          }
          continue;
        }
        const rewardType = ["coins", "exp", "baits"][
          Math.floor(Math.random() * 3)
        ];
        switch (rewardType) {
          case "coins":
            const coinAmount = Math.floor(Math.random() * (500 - 15 + 1)) + 15;
            player.money += coinAmount;
            totalRewards.coins += coinAmount;
            break;
          case "exp":
            const expAmount = Math.floor(Math.random() * (1000 - 10 + 1)) + 10;
            player.exp += expAmount;
            totalRewards.exp += expAmount;
            break;
          case "baits":
            const baitAmount = Math.floor(Math.random() * (50 - 5 + 1)) + 1;
            const baitTypes = ["bait_earthworm", "bait_shrimp", "bait_gold"];
            const chosenBaitId =
              baitTypes[Math.floor(Math.random() * baitTypes.length)];
            player.inventory.baits[chosenBaitId] =
              (player.inventory.baits[chosenBaitId] || 0) + baitAmount;
            totalRewards.baits[chosenBaitId] =
              (totalRewards.baits[chosenBaitId] || 0) + baitAmount;
            break;
        }
      }

      let rewardSummary = `✨ Bạn đã sử dụng ${quantity} Vé Quay và nhận được:\n\n`;
      if (totalRewards.coins > 0)
        rewardSummary += `💰 +${totalRewards.coins.toLocaleString("en-US")} coins\n`;
      if (totalRewards.exp > 0)
        rewardSummary += `⭐ +${totalRewards.exp.toLocaleString("en-US")} EXP\n`;
      for (const baitId in totalRewards.baits) {
        const baitInfo = getItem(baitId);
        rewardSummary += `🪱 +${totalRewards.baits[baitId]} ${baitInfo.name}\n`;
      }
      if (mythicalRodWon > 0)
        rewardSummary += `\n🎉🎉🎉 CHÚC MỪNG! 🎉🎉🎉\nBạn đã trúng ${mythicalRodWon} ${getItem("rod_mythical").name}!!!\n`;
      rewardSummary += `\nBạn còn lại ${player.inventory.gachaTickets} vé.`;
      responseText = rewardSummary;

      const completedQuests = [
        ...updateQuestProgress(player, "use_gacha", quantity),
        ...updateQuestProgress(player, "stats.gachaSpins", 0),
      ];
      if (completedQuests.length > 0) {
        questCompletionText = buildQuestCompletionMessage(completedQuests);
      }
      break;
    }

    case "cast": {
      if (!player.equipment.bait) {
        responseText = `Bạn cần trang bị mồi! Dùng \`${prefix}fishing mồi\`.`;
        break;
      }

      const equippedRodObject = player.inventory.rods.find(
        (r) => r.id === player.equipment.rod,
      );
      if (!equippedRodObject) {
        responseText = `⚠️ Lỗi: Không tìm thấy cần câu đang trang bị trong túi đồ của bạn.`;
        break;
      }
      if (equippedRodObject.currentDurability <= 0) {
        responseText = `🚫 Cần câu của bạn đã hỏng! Hãy dùng lệnh "${prefix}fishing suachua" để sửa chữa nó.`;
        break;
      }

      const currentArea =
        config.areas.find((a) => a.id === player.currentArea) ||
        config.areas[0];
      const equippedRod = getItem(player.equipment.rod);
      const equippedBait = getItem(player.equipment.bait);

      let bonuses = {
        exp: 0,
        rare: 0,
        legend: 0,
        common: 0,
        coin: 0,
        cooldown: 0,
        cooldownPercent: 0,
        extraCatch: 0,
        mythical: 0,
      };
      [
        equippedRod,
        equippedBait,
        ...player.inventory.tools.map(getItem),
      ].forEach((item) => {
        if (item?.effects) {
          bonuses.exp += item.effects.expBonus || 0;
          bonuses.rare += item.effects.rareChanceBonus || 0;
          bonuses.legend += item.effects.legendaryChanceBonus || 0;
          bonuses.mythical += item.effects.mythicalChanceBonus || 0;
          bonuses.coin += item.effects.coinBonus || 0;
          bonuses.cooldown += item.effects.cooldownReduction || 0;
          bonuses.cooldownPercent += item.effects.cooldownReductionPercent || 0;
          bonuses.extraCatch += item.effects.extraCatchChance || 0;
        }
      });

      const baseCooldown = config.cooldowns.cast;
      const finalCooldown = Math.max(
        5000,
        (baseCooldown - bonuses.cooldown) * (1 - bonuses.cooldownPercent),
      );
      const now = Date.now();
      if (now < player.cooldowns.cast) {
        responseText = `Chờ ${Math.ceil((player.cooldowns.cast - now) / 1000)} giây nữa.`;
        break;
      }

      let chances = Object.fromEntries(
        currentArea.fish.map((f) => [f.type, f.chance]),
      );
      chances.rare = (chances.rare || 0) + bonuses.rare;
      chances.legendary = (chances.legendary || 0) + bonuses.legend;
      chances.mythical = (chances.mythical || 0) + bonuses.mythical;
      chances.common = Math.max(
        0,
        (chances.common || 0) -
          (bonuses.rare + bonuses.legend + bonuses.mythical),
      );

      const rand = Math.random() * 100;
      let cumulativeChance = 0;
      let caughtFishRarity = "junk";
      for (const type of ["mythical", "legendary", "rare", "common", "junk"]) {
        if (chances[type]) {
          cumulativeChance += chances[type];
          if (rand <= cumulativeChance) {
            caughtFishRarity = type;
            break;
          }
        }
      }

      const caughtFishType = currentArea.fish.find(
        (f) => f.type === caughtFishRarity,
      );
      if (!caughtFishType) {
        responseText = "Hồ này không có cá!";
        break;
      }

      const nameOptions = currentArea.fishNames?.[caughtFishRarity];
      const caughtFishName = nameOptions
        ? nameOptions[Math.floor(Math.random() * nameOptions.length)]
        : caughtFishType.name;

      const [minExp, maxExp] = caughtFishType.exp;
      const baseExp =
        Math.floor(Math.random() * (maxExp - minExp + 1)) + minExp;
      const finalExpGained = Math.floor(baseExp * (1 + bonuses.exp));
      const finalCoinsGained = Math.floor(
        caughtFishType.value * (1 + bonuses.coin),
      );

      player.exp += finalExpGained;
      player.money += finalCoinsGained;
      player.inventory.fish[caughtFishName] =
        (player.inventory.fish[caughtFishName] || 0) + 1;
      player.stats.totalFishCaught++;
      player.stats[`${caughtFishRarity}Caught`] =
        (player.stats[`${caughtFishRarity}Caught`] || 0) + 1;

      const unlockedAchievements = checkAndAwardAchievements(player);

      const completedQuests = [];
      completedQuests.push(
        ...updateQuestProgress(player, "catch", 1, {
          rarity: "any",
          areaId: "any",
        }),
      );
      completedQuests.push(
        ...updateQuestProgress(player, "catch", 1, {
          rarity: caughtFishRarity,
          areaId: currentArea.id,
        }),
      );
      completedQuests.push(
        ...updateQuestProgress(player, "catch", 1, {
          rarity: caughtFishRarity,
          areaId: "any",
        }),
      );
      completedQuests.push(
        ...updateQuestProgress(player, "catch", 1, {
          rarity: "any",
          areaId: currentArea.id,
        }),
      );

      updateQuestProgress(player, "stats.totalFishCaught", 0);
      updateQuestProgress(player, `stats.${caughtFishRarity}Caught`, 0);
      updateQuestProgress(player, "earn_coins", finalCoinsGained);

      let levelUpText = "";
      let oldLevel = player.level;
      let totalLevelUpRewards = { coins: 0, baits: {} };

      while (player.exp >= player.expToNextLevel) {
        player.level++;
        player.exp -= player.expToNextLevel;
        player.expToNextLevel = Math.floor(player.expToNextLevel * 1.1);

        const reward = config.levelUpRewards?.[player.level];
        if (reward) {
          if (reward.coins) {
            player.money += reward.coins;
            totalLevelUpRewards.coins += reward.coins;
          }
          if (reward.baits) {
            for (const baitId in reward.baits) {
              const amount = reward.baits[baitId];
              player.inventory.baits[baitId] =
                (player.inventory.baits[baitId] || 0) + amount;
              totalLevelUpRewards.baits[baitId] =
                (totalLevelUpRewards.baits[baitId] || 0) + amount;
            }
          }
        }
      }

      if (player.level > oldLevel) {
        levelUpText = `\n\n🎉 BẠN ĐÃ LÊN CẤP ${player.level}!`;
        completedQuests.push(...updateQuestProgress(player, "reach_level", 0));
        let rewardSummary = "\n🎁 PHẦN THƯỞNG LÊN CẤP:\n";
        if (totalLevelUpRewards.coins > 0) {
          rewardSummary += `💰 +${totalLevelUpRewards.coins.toLocaleString("en-US")} coins\n`;
        }
        let baitRewardsText = [];
        for (const baitId in totalLevelUpRewards.baits) {
          const amount = totalLevelUpRewards.baits[baitId];
          const baitInfo = getItem(baitId);
          baitRewardsText.push(
            `🪱 +${amount} ${baitInfo ? baitInfo.name : "Mồi"}`,
          );
        }
        if (baitRewardsText.length > 0) {
          rewardSummary += baitRewardsText.join("\n");
        }
        levelUpText += rewardSummary;
      }

      const baitId = player.equipment.bait;
      const baitCountAfter = (player.inventory.baits[baitId] || 1) - 1;
      player.inventory.baits[baitId]--;
      if (player.inventory.baits[baitId] <= 0) {
        delete player.inventory.baits[baitId];
        player.equipment.bait = null;
      }

      equippedRodObject.castsSinceLoss =
        (equippedRodObject.castsSinceLoss || 0) + 1;
      if (
        equippedRodObject.castsSinceLoss >=
        equippedRod.effects.durabilityLossThreshold
      ) {
        equippedRodObject.currentDurability--;
        equippedRodObject.castsSinceLoss = 0;
      }

      player.cooldowns.cast = now + finalCooldown;

      let mainResponse = [];
      const durabilityText = `(Bền: ${equippedRodObject.currentDurability}/${equippedRod.effects.maxDurability})`;

      mainResponse.push(`🎣 ${player.name} câu cá tại ${currentArea.name}`);
      mainResponse.push(
        `🎣 Sử dụng: ${equippedRod.name} ${durabilityText} & ${equippedBait.name} (x${baitCountAfter})`,
      );
      mainResponse.push(`🌊 Plop! Có gì đó cắn câu!`);
      mainResponse.push(`🐡 ${caughtFishName} (${caughtFishType.name})`);
      mainResponse.push(`⭐ +${finalExpGained.toLocaleString("en-US")} EXP`);
      mainResponse.push(
        `💰 +${finalCoinsGained.toLocaleString("en-US")} coins`,
      );

      const ticketsWon = Math.floor(Math.random() * 10) + 1;
      player.inventory.gachaTickets =
        (player.inventory.gachaTickets || 0) + ticketsWon;
      mainResponse.push(`🎟️ Bạn nhận được ${ticketsWon} Vé Quay!`);

      mainResponse.push(
        `🎯 Level: ${player.level} | EXP: ${player.exp.toLocaleString("en-US")}/${player.expToNextLevel.toLocaleString("en-US")}`,
      );
      mainResponse.push(`💰 Coins: ${player.money.toLocaleString("en-US")}`);
      mainResponse.push(`📊 BXH: Gõ "${prefix}fishing rank" để xem`);

      if (completedQuests.length > 0) {
        questCompletionText = buildQuestCompletionMessage(completedQuests);
      }

      let achievementResponse = "";
      if (unlockedAchievements.length > 0) {
        const achievementEmojis = ["🎣", "🟡", "🏆", "✨", "💎", "👑"];
        unlockedAchievements.forEach((ach) => {
          const randomEmoji =
            achievementEmojis[
              Math.floor(Math.random() * achievementEmojis.length)
            ];
          achievementResponse +=
            `\n\n🎉 THÀNH TỰU MỚI! 🎉\n` +
            `${randomEmoji} ${ach.name}\n` +
            `✨ ${ach.description}\n` +
            `🎁 PHẦN THƯỞỞNG:\n` +
            (ach.rewards.coins
              ? `💰 +${ach.rewards.coins.toLocaleString("en-US")} coins\n`
              : "") +
            (ach.rewards.exp
              ? `⭐ +${ach.rewards.exp.toLocaleString("en-US")} EXP`
              : "");
        });
        achievementResponse += `\n🏆 Gõ "${prefix}fishing achievements" để xem tất cả thành tựu!`;
      }

      responseText =
        mainResponse.join("\n") +
        levelUpText +
        achievementResponse +
        questCompletionText;
      break;
    }

    case "achievements":
    case "thành tựu": {
      if (!config.achievements || config.achievements.length === 0) {
        responseText = "Chưa có thành tựu.";
        break;
      }
      responseText = `🏆 THÀNH TỰU CỦA ${player.name.toUpperCase()} 🏆\n\n`;
      const claimed = config.achievements.filter(
        (ach) => player.achievements[ach.id]?.claimed,
      );
      const unclaimed = config.achievements.filter(
        (ach) => !player.achievements[ach.id]?.claimed,
      );
      responseText += `🏅 Đã đạt: ${claimed.length}/${config.achievements.length}\n\n`;
      if (unclaimed.length > 0) {
        responseText += "🎯 Mục tiêu gần nhất:\n";
        unclaimed.forEach((ach) => {
          const playerStat = ach.type
            .split(".")
            .reduce((o, i) => (o ? o[i] : undefined), player);
          const progress = Math.min(
            100,
            Math.floor(((playerStat || 0) / ach.goal) * 100),
          );
          responseText += `- ${ach.name}: ${progress}%\n`;
        });
      }
      break;
    }

    case "team": {
      const teamAction = args[0] ? args[0].toLowerCase() : "help";
      const teamArgs = args.slice(1);
      switch (teamAction) {
        case "create": {
          if (player.teamId) {
            responseText = "⚠️ Bạn đã ở trong một team rồi.";
            break;
          }
          const teamName = teamArgs.join(" ");
          if (!teamName) {
            responseText = `⚠️ Vui lòng nhập tên team.`;
            break;
          }
          if (
            Object.values(allTeams).some(
              (t) => t.name.toLowerCase() === teamName.toLowerCase(),
            )
          ) {
            responseText = `⚠️ Tên team "${teamName}" đã tồn tại.`;
            break;
          }
          if (player.money < TEAM_CONFIG.creationCost) {
            responseText = `⚠️ Bạn cần ${TEAM_CONFIG.creationCost.toLocaleString("en-US")} coins.`;
            break;
          }
          player.money -= TEAM_CONFIG.creationCost;
          const newTeamId = Date.now().toString();
          allTeams[newTeamId] = {
            id: newTeamId,
            name: teamName,
            leader: player.userId,
            members: [
              {
                userId: player.userId,
                name: player.name,
                joinedAt: Date.now(),
              },
            ],
          };
          player.teamId = newTeamId;
          saveTeamData(allTeams);
          responseText = `✅ Đã tạo thành công team "${teamName}".`;

          const completedQuests = updateQuestProgress(player, "join_team", 1);
          if (completedQuests.length > 0) {
            questCompletionText = buildQuestCompletionMessage(completedQuests);
          }
          break;
        }
        case "join": {
          if (player.teamId) {
            responseText = "⚠️ Bạn đã ở trong một team rồi.";
            break;
          }
          const teamIndex = parseInt(teamArgs[0]) - 1;
          if (isNaN(teamIndex)) {
            responseText = "⚠️ Số thứ tự không hợp lệ.";
            break;
          }
          const validTeams = [];
          for (const teamId in allTeams) {
            if (await getPlayerName(api, allTeams[teamId].leader)) {
              validTeams.push(allTeams[teamId]);
            }
          }
          if (teamIndex < 0 || teamIndex >= validTeams.length) {
            responseText = "⚠️ Số thứ tự không hợp lệ.";
            break;
          }
          const targetTeam = validTeams[teamIndex];
          if (targetTeam.members.length >= TEAM_CONFIG.maxMembers) {
            responseText = "⚠️ Team này đã đủ thành viên.";
            break;
          }
          targetTeam.members.push({
            userId: player.userId,
            name: player.name,
            joinedAt: Date.now(),
          });
          player.teamId = targetTeam.id;
          saveTeamData(allTeams);
          responseText = `✅ Bạn đã tham gia team "${targetTeam.name}"!`;

          const completedQuests = updateQuestProgress(player, "join_team", 1);
          if (completedQuests.length > 0) {
            questCompletionText = buildQuestCompletionMessage(completedQuests);
          }
          break;
        }
        case "leave": {
          if (!player.teamId || !allTeams[player.teamId]) {
            responseText = "⚠️ Bạn không ở trong team nào cả.";
            break;
          }
          const teamId = player.teamId;
          const team = allTeams[teamId];
          const teamName = team.name;
          if (player.userId === team.leader) {
            responseText = `❗ Với tư cách là đội trưởng, bạn đã rời và giải tán team "${teamName}".`;
            const membersToUpdate = team.members.map((member) => member.userId);
            delete allTeams[teamId];
            saveTeamData(allTeams);
            membersToUpdate.forEach((memberId) => {
              if (allPlayers[memberId]) {
                allPlayers[memberId].teamId = null;
              }
            });
          } else {
            responseText = `✅ Bạn đã rời khỏi team "${teamName}".`;
            team.members = team.members.filter(
              (m) => m.userId !== player.userId,
            );
            player.teamId = null;
            saveTeamData(allTeams);
          }
          break;
        }
        case "infoteam":
        case "info": {
          if (!player.teamId || !allTeams[player.teamId]) {
            responseText = "⚠️ Bạn không ở trong team nào.";
            break;
          }
          const team = allTeams[player.teamId];
          const memberList = [];
          for (let i = 0; i < team.members.length; i++) {
            const member = team.members[i];
            const memberName =
              (await getPlayerName(api, member.userId)) || member.name;
            member.name = memberName;
            let role = member.userId === team.leader ? " (👑)" : "";
            memberList.push(`${i + 1}. ${memberName}${role}`);
          }
          responseText =
            `🔰 TEAM: ${team.name} 🔰\n` +
            `👥 ${team.members.length}/${TEAM_CONFIG.maxMembers} thành viên\n\n` +
            memberList.join("\n");
          saveTeamData(allTeams);
          break;
        }
        case "kick": {
          if (!player.teamId || !allTeams[player.teamId]) {
            responseText = "⚠️ Bạn không ở trong team nào.";
            break;
          }
          const team = allTeams[player.teamId];
          if (player.userId !== team.leader) {
            responseText = "⚠️ Chỉ đội trưởng mới có quyền kick.";
            break;
          }
          const memberIndex = parseInt(teamArgs[0]) - 1;
          if (
            isNaN(memberIndex) ||
            memberIndex < 0 ||
            memberIndex >= team.members.length
          ) {
            responseText = "⚠️ Số thứ tự không hợp lệ.";
            break;
          }
          const memberToKick = team.members[memberIndex];
          if (memberToKick.userId === player.userId) {
            responseText = "⚠️ Bạn không thể tự kick mình.";
            break;
          }
          team.members.splice(memberIndex, 1);
          if (allPlayers[memberToKick.userId]) {
            allPlayers[memberToKick.userId].teamId = null;
          }
          saveTeamData(allTeams);
          responseText = `✅ Đã kick ${memberToKick.name} ra khỏi team.`;
          break;
        }
        default: {
          responseText =
            `🔰 Lệnh Team 🔰\n\n` +
            `🔹 ${prefix}fishing team create <tên>\n` +
            `🔹 ${prefix}fishing team list\n` +
            `🔹 ${prefix}fishing team join <stt>\n` +
            `🔹 ${prefix}fishing team leave\n` +
            `🔹 ${prefix}fishing team info\n` +
            `🔹 ${prefix}fishing team kick <stt>`;
          break;
        }
      }
      break;
    }

    default:
      break;
  }

  if (questCompletionText && !responseText.includes("NHIỆM VỤ HOÀN THÀNH")) {
    responseText += questCompletionText;
  }

  checkAndAssignQuests(player);

  savePlayerData(allPlayers);
  const result = { success: true, message: responseText };
  await sendMessageFromSQL(api, message, result, true, 3600000);
}
