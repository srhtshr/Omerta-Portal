const cors = require("cors");
const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const familyKey = (process.env.FAMILY_KEY || "").trim();

const fs = require("fs");
const path = require("path");

const roomsFilePath = path.join(__dirname, "data", "rooms.json");

function loadRoomsStore() {
  try {
    if (fs.existsSync(roomsFilePath)) {
      const content = fs.readFileSync(roomsFilePath, "utf8");
      const data = JSON.parse(content);
      for (const room of Object.values(data)) {
        room.players = room.players || {};
        room.chat = room.chat || [];
        room.obay = room.obay || null;
        room.members = room.members || {};
        room.pending = room.pending || {};
        room.notes = room.notes || [];
        room.targets = room.targets || [];
      }
      return data;
    }
  } catch (error) {
    console.error("Failed to load rooms store", error);
  }
  return {};
}

function saveRoomsStore(data) {
  try {
    fs.mkdirSync(path.dirname(roomsFilePath), { recursive: true });
    const persisted = {};
    for (const [name, room] of Object.entries(data)) {
      persisted[name] = {
        ownerClientId: room.ownerClientId,
        ownerPlayer: room.ownerPlayer,
        members: room.members || {},
        pending: room.pending || {},
        notes: room.notes || [],
        targets: room.targets || []
      };
    }
    fs.writeFileSync(roomsFilePath, JSON.stringify(persisted, null, 2), "utf8");
  } catch (error) {
    console.error("Failed to save rooms store", error);
  }
}

const rooms = loadRoomsStore();
let modified = false;
if (Object.keys(rooms).length === 0) {
  rooms["General"] = {
    ownerClientId: "",
    ownerPlayer: "",
    members: {},
    pending: {},
    players: {},
    chat: [],
    obay: null,
    notes: [],
    targets: []
  };
  modified = true;
}
if (!rooms["General"]) {
  rooms["General"] = {
    ownerClientId: "",
    ownerPlayer: "",
    members: {},
    pending: {},
    players: {},
    chat: [],
    obay: null,
    notes: [],
    targets: []
  };
  modified = true;
}
if (modified) {
  saveRoomsStore(rooms);
}

app.use(cors());
app.use(express.json());
app.use("/icons", express.static(path.join(__dirname, "../icons")));

function getServerTime() {
  return Math.floor(Date.now() / 1000);
}

const serverCooldownUnlockRanks = {
  heist: "Shoplifter",
  organizedcrime: "Thief",
  megaorganizedcrime: "Assassin",
  spot: "Soldier"
};

const serverRankOrder = {
  "0": 0,
  emptysuit: 0,
  deliveryboy: 0,
  picciotto: 1,
  shoplifter: 2,
  pickpocket: 3,
  thief: 4,
  associate: 5,
  mobster: 6,
  soldier: 7,
  swindler: 8,
  assassin: 9,
  localchief: 10,
  chief: 11,
  bruglione: 12,
  godfather: 13,
  firstlady: 13,
  capodecina: 13
};

function normalizeServerRankKey(value) {
  if (!value) return "";
  const raw = String(value).toLowerCase().trim();
  const translationMap = {
    "dazlak": "emptysuit",
    "boş takım elbise": "emptysuit",
    "bos takim elbise": "emptysuit",
    "kurye": "deliveryboy",
    "tetikçi": "picciotto",
    "tetikci": "picciotto",
    "hırsız": "shoplifter",
    "hirsiz": "shoplifter",
    "dükkan hırsızı": "shoplifter",
    "dukkan hirsizi": "shoplifter",
    "yankesici": "pickpocket",
    "uzman hırsız": "thief",
    "uzman hirsiz": "thief",
    "ortak": "associate",
    "haydut": "mobster",
    "asker": "soldier",
    "dolandırıcı": "swindler",
    "dolandirici": "swindler",
    "suikastçi": "assassin",
    "suikastçı": "assassin",
    "suikastci": "assassin",
    "yerel şef": "localchief",
    "yerel sef": "localchief",
    "şef": "chief",
    "sef": "chief",
    "baba": "godfather",
    "first lady": "firstlady",
    "capodecina": "capodecina",
    "winkeldief": "shoplifter",
    "zakkenroller": "pickpocket",
    "inbreker": "thief",
    "oplichter": "swindler",
    "mão-de-ferro": "emptysuit",
    "sem terno": "emptysuit",
    "estafeta": "deliveryboy",
    "ladrão de lojas": "shoplifter",
    "carteirista": "pickpocket",
    "batedor de carteiras": "pickpocket",
    "ladrão": "thief",
    "associado": "associate",
    "ganster": "mobster",
    "gangster": "mobster",
    "soldado": "soldier",
    "vigarista": "swindler",
    "assassino": "assassin",
    "chefe local": "localchief",
    "chefe": "chief",
    "padrinho": "godfather"
  };
  if (Object.prototype.hasOwnProperty.call(translationMap, raw)) {
    return translationMap[raw];
  }
  return raw.replace(/[\s_-]+/g, "").replace(/[^a-z0-9]/g, "");
}

function getServerRankOrderValue(rank) {
  const normalized = normalizeServerRankKey(rank);
  if (!normalized || !Object.prototype.hasOwnProperty.call(serverRankOrder, normalized)) {
    return null;
  }
  return serverRankOrder[normalized];
}

function applyLockedCooldowns(cooldowns, rank) {
  const nextCooldowns = { ...(cooldowns || {}) };
  const playerRankValue = getServerRankOrderValue(rank);
  if (playerRankValue === null) {
    return nextCooldowns;
  }

  for (const [cooldownKey, unlockRank] of Object.entries(serverCooldownUnlockRanks)) {
    const unlockRankValue = getServerRankOrderValue(unlockRank);
    if (unlockRankValue === null || playerRankValue >= unlockRankValue) {
      continue;
    }

    const matchingKey = Object.keys(nextCooldowns).find((key) => normalizeServerRankKey(key) === cooldownKey);
    if (!matchingKey) {
      continue;
    }

    nextCooldowns[matchingKey] = {
      ...(nextCooldowns[matchingKey] || {}),
      ready: false,
      locked: true,
      unlockRank
    };
  }

  return nextCooldowns;
}

function pruneTransientTestPlayers(roomData, serverTime) {
  if (!roomData || !roomData.players || typeof roomData.players !== "object") {
    return;
  }

  for (const [playerKey, entry] of Object.entries(roomData.players)) {
    const playerName = String(entry && entry.player ? entry.player : "").trim().toLowerCase();
    const updatedAt = Number(entry && entry.updatedAt);
    if (playerName === "testplayer" && Number.isFinite(updatedAt) && serverTime - updatedAt > 300) {
      delete roomData.players[playerKey];
    }
  }
}

function renderDashboardHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Omerta Portal v1.0</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0f131a;
        --panel: #171d27;
        --panel-2: #1d2430;
        --border: #2c3647;
        --text: #edf2f7;
        --muted: #98a3b5;
        --green: #33d17a;
        --yellow: #f6c453;
        --red: #ff6b6b;
        --gray: #6f7b8f;
        --accent: #5aa9ff;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background:
          radial-gradient(circle at top, rgba(90, 169, 255, 0.12), transparent 35%),
          linear-gradient(180deg, #0d1117 0%, var(--bg) 100%);
        color: var(--text);
      }

      .page {
        width: 95vw;
        max-width: 1800px;
        margin: 0 auto;
        padding: 10px;
      }

      .topbar {
        display: flex;
        gap: 10px;
        align-items: center;
        margin-bottom: 14px;
        flex-wrap: wrap;
      }

      .brand {
        font-size: 22px;
        font-weight: 700;
        margin-right: auto;
      }

      .topbar-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .topbar-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.03);
        color: var(--text);
        text-decoration: none;
        font-size: 12px;
        font-weight: 700;
        transition: all 0.2s ease;
      }

      .topbar-link:hover {
        border-color: var(--accent);
        color: var(--accent);
      }

      .nicknames-strip {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        flex-wrap: wrap;
      }

      .nickname-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: rgba(23, 29, 39, 0.92);
        text-decoration: none;
        transition: all 0.2s ease;
        width: 160px;
      }

      .nickname-card:hover {
        border-color: var(--accent);
        box-shadow: 0 0 10px rgba(90, 169, 255, 0.18);
      }

      .connect-button-card {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 10px 12px;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: linear-gradient(180deg, #2b71c8 0%, #1f5ca8 100%);
        color: var(--text);
        font-weight: 700;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        width: 160px;
        box-sizing: border-box;
        text-shadow: 0 1px 2px rgba(0,0,0,0.3);
      }

      .connect-button-card:hover:not(:disabled) {
        border-color: var(--accent);
        box-shadow: 0 0 10px rgba(90, 169, 255, 0.3);
        filter: brightness(1.08);
      }

      .connect-button-card:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .nickname-server {
        color: var(--muted);
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.4px;
      }

      .nickname-player {
        color: var(--text);
        font-size: 12px;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .input,
      .button {
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--panel);
        color: var(--text);
        padding: 8px 10px;
        font-size: 13px;
      }

      .input {
        min-width: 220px;
      }

      .search-input {
        min-width: 220px;
      }

      .input[readonly] {
        opacity: 0.8;
        cursor: default;
      }

      .button {
        background: linear-gradient(180deg, #2b71c8 0%, #1f5ca8 100%);
        cursor: pointer;
      }

      .button:hover {
        filter: brightness(1.08);
      }

      .layout {
        display: grid;
        grid-template-columns: minmax(0, 2.8fr) minmax(360px, 1.15fr);
        gap: 12px;
      }

      .panel {
        background: rgba(23, 29, 39, 0.92);
        border: 1px solid var(--border);
        border-radius: 14px;
        overflow: hidden;
        backdrop-filter: blur(10px);
      }

      .server-chip {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 4px 10px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        user-select: none;
      }

      .server-chip:hover {
        background: rgba(255, 255, 255, 0.06);
        border-color: var(--muted);
      }

      .server-chip.active {
        background: rgba(90, 169, 255, 0.1);
        border-color: var(--accent);
        box-shadow: 0 0 8px rgba(90, 169, 255, 0.2);
      }

      .server-chip-name {
        font-size: 11px;
        font-weight: 700;
        color: var(--text);
        letter-spacing: 0.3px;
      }

      .server-chip-status {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        transition: all 0.2s ease;
      }

      .server-chip.has-players .server-chip-status {
        background: var(--green);
        box-shadow: 0 0 6px var(--green);
      }

      .server-chip.no-players .server-chip-status {
        background: var(--gray);
      }

      .server-chip.no-players {
        opacity: 0.6;
      }

      .server-chip.no-players:hover {
        opacity: 0.9;
      }

      .quick-links-container {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: nowrap;
        justify-content: space-between;
      }

      #rankFilterSelect {
        border: 1px solid var(--border);
        border-radius: 6px;
        background-color: rgba(23, 29, 39, 0.95);
        color: var(--text);
        padding: 4px 8px;
        font-size: 11px;
        width: 120px;
        outline: none;
        transition: border-color 0.15s ease;
        cursor: pointer;
        height: 23px;
      }

      #rankFilterSelect:hover {
        border-color: var(--accent);
      }

      #rankFilterSelect option {
        background-color: var(--panel-2);
        color: var(--text);
      }

      #myCharacterFilterBtn {
        border: 1px solid var(--border);
        border-radius: 6px;
        background-color: rgba(23, 29, 39, 0.95);
        color: var(--text);
        padding: 4px 8px;
        font-size: 11px;
        min-width: 120px;
        outline: none;
        transition: all 0.15s ease;
        cursor: pointer;
        height: 23px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        white-space: nowrap;
      }

      #myCharacterFilterBtn:hover {
        border-color: var(--accent);
      }

      #myCharacterFilterBtn.active {
        border-color: var(--accent);
        background: linear-gradient(180deg, #2b71c8 0%, #1f5ca8 100%);
        box-shadow: 0 0 8px rgba(90, 169, 255, 0.3);
      }

      .quick-link-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        flex: 0 0 auto;
        text-decoration: none;
        color: var(--muted);
        transition: all 0.2s ease;
        cursor: pointer;
      }

      .quick-link-title {
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        opacity: 0.8;
      }

      .quick-link-icon {
        width: 28px;
        height: 28px;
        object-fit: contain;
        border-radius: 6px;
        transition: all 0.2s ease;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
      }

      .quick-link-item:hover {
        color: var(--accent);
      }

      .quick-link-item:hover .quick-link-icon {
        transform: translateY(-2px);
        box-shadow: 0 0 8px rgba(90, 169, 255, 0.6);
        filter: brightness(1.1);
      }

      .quick-link-spacer {
        width: 1px;
        height: 24px;
        background: var(--border);
        margin: 0 4px;
        align-self: flex-end;
      }

      .table-filters {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        padding: 8px 14px 0;
      }

      .main-column {
        display: grid;
        gap: 12px;
        align-content: start;
      }

      .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 12px 14px;
        border-bottom: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.02);
      }

      .panel-title {
        font-size: 15px;
        font-weight: 700;
      }

      .header-link {
        color: inherit;
        text-decoration: none;
        transition: color 0.15s ease, text-decoration-color 0.15s ease;
      }

      .header-link:hover {
        color: var(--accent);
        text-decoration: underline;
      }

      .panel-link {
        color: var(--muted);
        text-decoration: none;
        font-size: 12px;
        font-weight: 700;
      }

      .panel-link:hover {
        color: var(--accent);
        text-decoration: underline;
      }

      .inline-action {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .mini-link-button {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: rgba(90, 169, 255, 0.14);
        color: var(--text);
        text-decoration: none;
        font-size: 10px;
        font-weight: 700;
      }

      .mini-link-button:hover {
        color: var(--accent);
        border-color: var(--accent);
      }

      .toggle-button {
        appearance: none;
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
        padding: 0;
      }

      .toggle-button:hover {
        color: var(--accent);
      }

      .sortable-header {
        appearance: none;
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
        padding: 0;
      }

      .sortable-header.active {
        color: var(--accent);
      }

      .status-line {
        color: var(--muted);
        font-size: 12px;
      }

      .table-wrap {
        overflow: hidden;
        padding: 0 4px 4px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      th,
      td {
        padding: 7px 5px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        text-align: center;
        vertical-align: middle;
        white-space: nowrap;
        font-size: 11px;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      th {
        position: sticky;
        top: 0;
        background: var(--panel-2);
        color: var(--muted);
        z-index: 1;
      }

      tbody tr:hover {
        background: rgba(255, 255, 255, 0.03);
      }

      th:first-child,
      td:first-child {
        width: 28px;
        padding-left: 0;
        padding-right: 0;
      }

      th:nth-child(2),
      td:nth-child(2) {
        width: 78px;
      }

      th:nth-child(3),
      td:nth-child(3) {
        width: 76px;
      }

      th:nth-child(4),
      td:nth-child(4) {
        width: 68px;
      }

      th:nth-child(5),
      td:nth-child(5) {
        width: 65px;
      }

      th:nth-child(6),
      td:nth-child(6) {
        width: 80px;
      }

      th:nth-child(n + 7):nth-child(-n + 19),
      td:nth-child(n + 7):nth-child(-n + 19) {
        width: 58px;
        overflow: visible;
        text-overflow: clip;
        font-size: 10px;
      }

      th:last-child,
      td:last-child {
        width: 70px;
      }

      .plating-very-high { color: var(--green); font-weight: bold; }
      .plating-high { color: #8ae234; font-weight: bold; }
      .plating-medium { color: var(--yellow); font-weight: bold; }
      .plating-low { color: #ff9f43; font-weight: bold; }
      .plating-very-low { color: var(--red); font-weight: bold; }
      .plating-none { color: var(--gray); }

      td:nth-child(2),
      td:nth-child(3) {
        text-align: left;
        padding-left: 8px;
      }

      th:nth-child(2),
      th:nth-child(3) {
        text-align: left;
        padding-left: 8px;
      }

      .text-cell {
        display: flex;
        align-items: center;
        min-height: 18px;
        width: 100%;
      }

      .player-name {
        color: var(--yellow);
        font-weight: 700;
        text-decoration: none;
      }

      .player-name:hover {
        text-decoration: none;
        filter: brightness(1.15);
      }

      .rank-name {
        color: var(--text);
        font-weight: 700;
      }

      .player-offline {
        color: var(--gray);
      }

      .ready {
        color: var(--green);
        font-weight: 700;
      }

      .waiting {
        color: var(--yellow);
      }

      .offline-badge {
        color: var(--gray);
        font-weight: 700;
      }

      .online-badge {
        color: var(--green);
        font-weight: 700;
      }

      .status-dot {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        vertical-align: middle;
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
      }

      .status-dot.online {
        background: var(--green);
      }

      .status-dot.offline {
        background: var(--gray);
      }

      .muted {
        color: var(--muted);
      }

      .chat {
        display: flex;
        flex-direction: column;
        height: 560px;
        min-height: 560px;
      }

      .chat-messages {
        padding: 12px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1 1 auto;
        min-height: 160px;
        background: #0b141a;
      }

      .chat-empty {
        color: var(--muted);
        font-size: 11px;
        text-align: center;
        margin-top: 20px;
      }

      .chat-item {
        display: flex;
        flex-direction: column;
        max-width: 80%;
        padding: 6px 10px;
        border-radius: 10px;
        font-size: 11px;
        line-height: 1.3;
        position: relative;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        transition: background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        border: 1px solid transparent;
      }

      .chat-item.own {
        align-self: flex-start;
        background: #005c4b; /* WhatsApp own bubble color */
        color: #edf2f7;
      }

      .chat-item.own:hover {
        background: #0a6f5a;
        border-color: rgba(141, 194, 255, 0.35);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);
      }

      .chat-item.other {
        align-self: flex-start;
        background: #202c33; /* WhatsApp other bubble color */
        color: #edf2f7;
      }

      .chat-content {
        word-break: break-word;
      }

      .chat-actions {
        display: flex;
        align-items: center;
      }

      .chat-meta-row {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 4px;
      }

      .chat-reply-button {
        border: 0;
        background: transparent;
        color: var(--accent);
        font-size: 10px;
        font-weight: 700;
        cursor: pointer;
        padding: 0;
      }

      .chat-reply-button:hover {
        color: #8dc2ff;
      }

      .chat-player {
        color: var(--yellow);
        font-weight: 700;
        margin-right: 4px;
        text-decoration: none;
        border-radius: 3px;
        padding: 0 2px;
        transition: color 0.15s, background 0.15s;
        cursor: pointer;
      }

      .chat-player:hover {
        color: var(--accent);
        background: rgba(90, 169, 255, 0.12);
        text-decoration: underline;
      }

      .chat-text {
        color: var(--text);
      }

      .chat-keyword {
        color: var(--yellow);
        font-weight: 700;
      }

      .chat-template-icon {
        margin-right: 4px;
      }

      .chat-location {
        text-transform: uppercase;
        color: #ffffff;
        font-weight: 800;
        letter-spacing: 0.2px;
      }

      .chat-item.template-message {
        border-color: rgba(255, 214, 102, 0.22);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.24);
      }

      .chat-item.template-message.own {
        background: linear-gradient(135deg, #0c6b58 0%, #07584a 100%);
      }

      .chat-item.template-message.other {
        background: linear-gradient(135deg, #263847 0%, #1d2d38 100%);
      }

      .chat-item.template-message .chat-keyword {
        color: #7fd3ff !important;
        font-weight: 800;
        text-shadow: 0 0 8px rgba(127, 211, 255, 0.18);
      }

      .chat-item.template-message .chat-location {
        color: #ffffff !important;
        font-weight: 800;
      }

      .chat-time {
        color: #8696a0; /* WhatsApp muted gray time */
        font-size: 8px;
        white-space: nowrap;
      }

      .chat-form {
        padding: 10px;
        border-top: 1px solid var(--border);
        display: grid;
        gap: 6px;
      }

      .chat-shortcuts {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .chat-shortcut {
        padding: 4px 8px;
        font-size: 10px;
        background: var(--panel-2);
        border: 1px solid var(--border);
        border-radius: 999px;
        color: var(--text);
        cursor: pointer;
      }

      .chat-shortcut:hover {
        border-color: var(--accent);
        color: var(--accent);
      }

      .chat-row {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
      }

      textarea.input {
        min-height: 50px;
        resize: vertical;
        font-size: 12px;
      }

      .emoji-item {
        cursor: pointer;
        font-size: 18px;
        text-align: center;
        user-select: none;
        padding: 4px;
        transition: background 0.1s ease;
      }

      .emoji-item:hover {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 6px;
      }

      .feedback {
        min-height: 14px;
        font-size: 11px;
        color: var(--muted);
      }

      .feedback.error {
        color: var(--red);
        font-weight: bold;
      }

      .feedback.success {
        color: var(--accent);
        font-weight: bold;
      }

      .obay-panel-body {
        display: block;
      }

      .obay-panel-body.collapsed {
        display: none;
      }

      .room-bar {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
        padding: 4px 0;
        margin-top: -6px;
        margin-bottom: -4px;
      }

      .room-tab {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid var(--border);
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        color: var(--muted);
        text-decoration: none;
        cursor: pointer;
        user-select: none;
        transition: all 0.2s ease;
      }

      .room-tab.active {
        background: var(--panel-2);
        color: var(--accent);
        border-color: var(--accent);
        box-shadow: 0 0 8px rgba(90, 169, 255, 0.2);
      }

      .room-tab:hover:not(.active) {
        background: rgba(255, 255, 255, 0.06);
        color: var(--text);
      }

      .room-tab-close {
        font-size: 14px;
        line-height: 1;
        color: var(--muted);
        border-radius: 50%;
        width: 14px;
        height: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s, color 0.15s;
        margin-left: 4px;
      }

      .room-tab-close:hover {
        background: var(--red);
        color: white;
      }

      .chat-pin-button {
        border: 0;
        background: transparent;
        color: var(--muted);
        font-size: 10px;
        font-weight: 700;
        cursor: pointer;
        padding: 0;
        margin-left: 6px;
      }

      .chat-pin-button:hover {
        color: var(--yellow);
      }

      .target-item,
      .note-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: var(--panel-2);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 11px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }

      .target-name {
        font-weight: 700;
        color: var(--accent);
        cursor: pointer;
      }
      .delete-btn {
        appearance: none;
        background: transparent;
        border: 0;
        color: var(--muted);
        cursor: pointer;
        font-size: 12px;
        line-height: 1;
        padding: 2px 4px;
        transition: color 0.15s;
      }

      .delete-btn:hover {
        color: var(--red);
      }

      .skull-btn {
        appearance: none;
        background: transparent;
        border: 0;
        color: var(--muted);
        cursor: pointer;
        font-size: 13px;
        line-height: 1;
        padding: 2px 4px;
        transition: color 0.15s, filter 0.15s;
        flex-shrink: 0;
      }

      .skull-btn:hover {
        color: var(--red);
        filter: drop-shadow(0 0 4px rgba(255,107,107,0.7));
      }

      .skull-btn.is-dead {
        color: var(--red);
        filter: drop-shadow(0 0 5px rgba(255,107,107,0.5));
      }

      .target-item {
        display: flex;
        align-items: center;
        background: rgba(255,255,255,0.04);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 6px 8px;
        gap: 4px;
        transition: opacity 0.3s, border-color 0.3s;
      }

      .target-item.is-dead {
        opacity: 0.38;
        border-color: rgba(255,107,107,0.25);
        background: rgba(255,107,107,0.04);
      }

      .target-item.is-dead .target-name {
        text-decoration: line-through;
        color: var(--muted);
      }

      .target-name {
        font-size: 11px;
        font-weight: 700;
        color: var(--text);
        text-decoration: none;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: color 0.3s;
      }

      .target-name:hover {
        color: var(--accent);
        filter: brightness(1.15);
      }

      .note-item {
        display: flex;
        align-items: flex-start;
        background: rgba(255,255,255,0.04);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 6px 8px;
        gap: 4px;
      }

      .added-by-badge {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 9px;
        color: var(--muted);
        font-weight: 600;
        margin-top: 1px;
      }

      .item-meta {
        font-size: 9px;
        color: var(--muted);
        margin-top: 2px;
      }

      @media (max-width: 1100px) {
        .layout {
          grid-template-columns: 1fr;
        }



        .chat {
          height: 560px;
          min-height: 560px;
        }

        .chat-messages {
          min-height: 160px;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="topbar">
        <div class="brand">Omerta Portal v1.0</div>
        <div class="topbar-actions">
          <a id="downloadExtensionLink" class="topbar-link" href="https://github.com/srhtshr/Omerta-Portal/raw/main/extension.zip" target="_blank" rel="noopener noreferrer">Download Extension</a>
        </div>
        <input id="roomInput" type="hidden" value="General">
        <button id="applyRoomButton" class="button" type="button" style="display: none;">Open Room</button>
      </div>

      <div class="nicknames-strip">
        <a id="nicknameCardTR" class="nickname-card" href="https://omerta.com.tr/index.php#/information.php" target="_blank" rel="noopener noreferrer">
          <span class="nickname-server">TR</span>
          <span id="nicknamePlayerTR" class="nickname-player">-</span>
        </a>
        <a id="nicknameCardCOM" class="nickname-card" href="https://barafranca.com/index.php#/information.php" target="_blank" rel="noopener noreferrer">
          <span class="nickname-server">COM</span>
          <span id="nicknamePlayerCOM" class="nickname-player">-</span>
        </a>
        <a id="nicknameCardNL" class="nickname-card" href="https://barafranca.nl/index.php#/information.php" target="_blank" rel="noopener noreferrer">
          <span class="nickname-server">NL</span>
          <span id="nicknamePlayerNL" class="nickname-player">-</span>
        </a>
        <a id="nicknameCardPT" class="nickname-card" href="https://omerta.pt/index.php#/information.php" target="_blank" rel="noopener noreferrer">
          <span class="nickname-server">PT</span>
          <span id="nicknamePlayerPT" class="nickname-player">-</span>
        </a>
        <button id="dashboardConnectBtn" class="button connect-button-card" type="button">Connect</button>
      </div>

      <div class="layout">
        <div class="main-column">
          <!-- Unauthorized View overlay -->
          <div id="unauthorizedView" style="display: none; padding: 40px; text-align: center; background: rgba(23, 29, 39, 0.92); border: 1px solid var(--border); border-radius: 14px; backdrop-filter: blur(10px);">
             <div id="unauthorizedIcon" style="font-size: 48px; margin-bottom: 16px;">🔒</div>
             <h2 id="unauthorizedTitle" style="margin: 0 0 10px 0;">Access Restricted</h2>
             <p id="unauthorizedMessage" style="color: var(--muted); margin-bottom: 20px; font-size: 14px;">You are not a member of this room.</p>
             <button id="unauthorizedJoinBtn" class="button" style="display: none; padding: 8px 16px;">Join Room</button>
          </div>

          <section id="cooldownsPanel" class="panel">
            <div class="panel-header">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <div id="roomTitle" style="display: none;">General</div>
                <div class="server-chip" id="card-tr" onclick="selectServer('tr')">
                  <span class="server-chip-name" id="name-tr">TR (0)</span>
                  <div class="server-chip-status" id="status-tr"></div>
                </div>
                <div class="server-chip" id="card-com" onclick="selectServer('com')">
                  <span class="server-chip-name" id="name-com">COM (0)</span>
                  <div class="server-chip-status" id="status-com"></div>
                </div>
                <div class="server-chip" id="card-nl" onclick="selectServer('nl')">
                  <span class="server-chip-name" id="name-nl">NL (0)</span>
                  <div class="server-chip-status" id="status-nl"></div>
                </div>
                <div class="server-chip" id="card-pt" onclick="selectServer('pt')">
                  <span class="server-chip-name" id="name-pt">PT (0)</span>
                  <div class="server-chip-status" id="status-pt"></div>
                </div>
                <div id="stateMeta" class="status-line" style="margin-left: 8px;">Waiting for room selection.</div>
                <form id="playerProfileSearchForm" style="display: inline-flex; align-items: center; margin-left: 14px; gap: 4px;" onsubmit="handlePlayerProfileSearch(event)">
                  <input id="playerSearchInput" type="text" placeholder="Search player profile..." style="border: 1px solid var(--border); border-radius: 6px; background: rgba(0, 0, 0, 0.2); color: var(--text); padding: 4px 8px; font-size: 11px; width: 140px; outline: none; transition: border-color 0.15s ease;" autocomplete="off" title="Enter character name and press Enter or Go">
                  <button type="submit" style="background: linear-gradient(180deg, #2b71c8 0%, #1f5ca8 100%); border: none; border-radius: 6px; color: var(--text); padding: 4px 10px; font-size: 11px; font-weight: 700; cursor: pointer; transition: filter 0.15s;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='none'">Go</button>
                </form>
                <select id="rankFilterSelect">
                  <option value="">All ranks</option>
                </select>
                <button id="myCharacterFilterBtn" type="button">Character: -</button>
              </div>
              <div class="quick-links-container" id="quickLinks">
                <a class="quick-link-item" id="link-crims" href="#" target="_blank" rel="noopener noreferrer">
                  <span class="quick-link-title">Crims</span>
                  <img class="quick-link-icon" src="/icons/Crims.png" alt="Crims">
                </a>
                <a class="quick-link-item" id="link-car" href="#" target="_blank" rel="noopener noreferrer">
                  <span class="quick-link-title">Car</span>
                  <img class="quick-link-icon" src="/icons/Car.png" alt="Car">
                </a>
                <a class="quick-link-item" id="link-smuggling" href="#" target="_blank" rel="noopener noreferrer">
                  <span class="quick-link-title">Smuggling</span>
                  <img class="quick-link-icon" src="/icons/Alchol-Drugs.png" alt="Smuggling">
                </a>
                <a class="quick-link-item" id="link-groupCrimes" href="#" target="_blank" rel="noopener noreferrer">
                  <span class="quick-link-title">Crimes</span>
                  <img class="quick-link-icon" src="/icons/Crimes.png" alt="Crimes">
                </a>
                <a class="quick-link-item" id="link-races" href="#" target="_blank" rel="noopener noreferrer">
                  <span class="quick-link-title">Races</span>
                  <img class="quick-link-icon" src="/icons/Races.png" alt="Races">
                </a>
                <a class="quick-link-item" id="link-bullet" href="#" target="_blank" rel="noopener noreferrer">
                  <span class="quick-link-title">Bullet</span>
                  <img class="quick-link-icon" src="/icons/Bullet.png" alt="Bullet">
                </a>
                
                <div class="quick-link-spacer"></div>
 
                <a class="quick-link-item" id="link-kill" href="#" target="_blank" rel="noopener noreferrer">
                  <span class="quick-link-title">Kill</span>
                  <img class="quick-link-icon" src="/icons/Kill.png" alt="Kill">
                </a>
                <a class="quick-link-item" id="link-hospital" href="#" target="_blank" rel="noopener noreferrer">
                  <span class="quick-link-title">Hospital</span>
                  <img class="quick-link-icon" src="/icons/Hospital.png" alt="Hospital">
                </a>
 
                <div class="quick-link-spacer"></div>
 
                <a class="quick-link-item" id="link-fly" href="#" target="_blank" rel="noopener noreferrer">
                  <span class="quick-link-title">Fly</span>
                  <img class="quick-link-icon" src="/icons/Fly.png" alt="Fly">
                </a>
                <a class="quick-link-item" id="link-market" href="#" target="_blank" rel="noopener noreferrer">
                  <span class="quick-link-title">Market</span>
                  <img class="quick-link-icon" src="/icons/Market.png" alt="Market">
                </a>
                <a class="quick-link-item" id="link-garage" href="#" target="_blank" rel="noopener noreferrer">
                  <span class="quick-link-title">Garage</span>
                  <img class="quick-link-icon" src="/icons/Garage.png" alt="Garage">
                </a>
              </div>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th title="Online"></th>
                    <th title="Player Name">Player Name</th>
                    <th title="Rank"><button id="rankSortButton" class="sortable-header" type="button">Rank</button></th>
                    <th title="Progress">Progress</th>
                    <th title="Activity">Activity</th>
                    <th title="Plating">Plating</th>
                    <th title="Crims">Crims</th>
                    <th title="Car">Car</th>
                    <th title="Race">Race</th>
                    <th title="Heist">Heist</th>
                    <th title="Oc">Oc</th>
                    <th title="Moc">Moc</th>
                    <th title="Spots">Spots</th>
                    <th title="Alchol">Alchol</th>
                    <th title="Drug">Drug</th>
                    <th title="Bullet">Bullet</th>
                    <th title="Kill">Kill</th>
                    <th title="Blood">Blood</th>
                    <th title="Fly">Fly</th>
                    <th title="Update">Update</th>
                  </tr>
                </thead>
                <tbody id="cooldownTableBody">
                  <tr>
                    <td colspan="20" class="muted">No room selected.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <!-- Room Bar -->
          <div id="roomBar" class="room-bar">
            <div id="roomTabsContainer" style="display: flex; gap: 6px; flex-wrap: wrap;"></div>
            <div style="margin-left: auto; display: flex; gap: 6px; align-items: center;">
              <input id="newRoomInput" class="input" type="text" placeholder="Room Name..." style="min-width: 140px; padding: 6px 10px;" maxlength="32">
              <button id="createRoomBtn" class="button" type="button" style="padding: 6px 12px;">Create</button>
              <button id="joinRoomBtn" class="button" type="button" style="padding: 6px 12px;">Join</button>
            </div>
          </div>

          <section id="obayPanel" class="panel">
            <div class="panel-header">
              <div>
                <button id="obayToggleButton" class="toggle-button panel-title" type="button">Obay Auctions</button>
                <div id="obayMeta" class="status-line">No Obay data loaded.</div>
              </div>
            </div>
            <div id="obayPanelBody" class="obay-panel-body">
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th title="Name">Name</th>
                      <th title="Seller">Seller</th>
                      <th title="Minimum Bid">Minimum Bid</th>
                      <th title="Bidder">Bidder</th>
                      <th title="End">End</th>
                    </tr>
                  </thead>
                  <tbody id="obayTableBody">
                    <tr>
                      <td colspan="5" class="muted">No Obay data yet. Open Obay auctions page with the extension enabled.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>

        <aside id="chatPanel" class="panel chat" style="position: relative;">
          <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; gap: 6px;">
            <div style="flex: 1; min-width: 0; overflow: hidden;">
              <div id="chatPanelTitle" class="panel-title" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="Room Name">Room</div>
              <div id="chatMeta" class="status-line" style="display: none;">No messages loaded.</div>
            </div>
            <!-- Targets & Notes header buttons - only visible in private rooms -->
            <div id="notesPanelHeaderButtons" style="display: none; gap: 4px; align-items: center; flex-shrink: 0;">
              <button id="headerTargetsBtn" type="button" class="button" style="padding: 3px 8px; font-size: 10px; background: var(--panel-2); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; color: var(--muted); font-weight: bold; white-space: nowrap;" onclick="toggleHeaderTab('targets')">
                🎯 Targets (<span id="targetsCount">0</span>)
              </button>
              <button id="headerNotesBtn" type="button" class="button" style="padding: 3px 8px; font-size: 10px; background: var(--panel-2); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; color: var(--muted); font-weight: bold; white-space: nowrap;" onclick="toggleHeaderTab('notes')">
                📝 Notes (<span id="notesCount">0</span>)
              </button>
            </div>
            <div style="display: flex; gap: 6px; align-items: center; flex-shrink: 0;">
              <button id="chatSoundToggleBtn" type="button" class="button" style="padding: 4px 8px; font-size: 10px; background: var(--panel-2); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; color: var(--text); font-weight: bold; flex-shrink: 0;" onclick="toggleChatSound()">
                🔊 Sound: ON
              </button>
              <button id="chatAdminToggleBtn" type="button" class="button" style="display: none; padding: 4px 8px; font-size: 10px; background: var(--panel-2); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; color: var(--yellow); font-weight: bold; flex-shrink: 0;" onclick="toggleChatAdmin()">
                🛡️ Admin
              </button>
            </div>
          </div>

          <!-- Collapsible Targets & Notes Panel body (only visible in private rooms, toggled by header buttons) -->
          <div id="notesPanel" class="chat-notes-panel" style="display: none; border-bottom: 1px solid var(--border); background: var(--panel-2);">
            <div id="notesPanelBody" style="padding: 10px 12px 12px 12px; background: rgba(0,0,0,0.15);">
              <!-- Targets Tab View -->
              <div id="tabTargetsView">
                <form id="addTargetForm" style="display: flex; gap: 6px; margin-bottom: 8px;" onsubmit="handleNewTarget(event)">
                  <input id="targetNameInput" class="input" type="text" placeholder="Target name..." style="flex: 1; min-width: 0; padding: 4px 8px; font-size: 11px; height: 26px;" autocomplete="off" required>
                  <button type="submit" class="button" style="padding: 0 10px; font-size: 11px; font-weight: bold; height: 26px;">Add</button>
                </form>
                <div id="targetsListContainer" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 6px; max-height: 140px; overflow-y: auto; padding-right: 2px;">
                  <span class="muted" style="font-size: 10px;">No targets added yet.</span>
                </div>
              </div>
              <!-- Notes Tab View -->
              <div id="tabNotesView" style="display: none;">
                <form id="addNoteForm" style="display: flex; gap: 6px; margin-bottom: 8px;" onsubmit="handleNewNote(event)">
                  <input id="noteTextInput" class="input" type="text" placeholder="Note text (safehouse coords, planning)..." style="flex: 1; min-width: 0; padding: 4px 8px; font-size: 11px; height: 26px;" autocomplete="off" required>
                  <button type="submit" class="button" style="padding: 0 10px; font-size: 11px; font-weight: bold; height: 26px;">Add</button>
                </form>
                <div id="notesListContainer" style="display: flex; flex-direction: column; gap: 6px; max-height: 140px; overflow-y: auto; padding-right: 2px;">
                  <span class="muted" style="font-size: 10px;">No notes added yet.</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Compact Chat Administration Panel Overlay -->
          <div id="chatAdminPanel" style="display: none; position: absolute; top: 42px; left: 10px; right: 10px; background: #171d27; border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7); z-index: 100; padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding-bottom: 6px;">
              <span style="font-size: 11px; font-weight: bold; color: var(--yellow);">Room Administration</span>
              <button type="button" style="font-size: 14px; color: var(--muted); border: none; background: transparent; cursor: pointer; line-height: 1; padding: 0 4px;" onclick="toggleChatAdmin()">✕</button>
            </div>
            <div id="chatAdminContent" style="display: grid; grid-template-columns: 1fr 1.1fr; gap: 8px; font-size: 10px;">
              <div>
                <div style="font-weight: bold; color: var(--yellow); margin-bottom: 4px;">Pending:</div>
                <div id="compactPendingList" style="max-height: 120px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;"></div>
              </div>
              <div>
                <div style="font-weight: bold; color: var(--accent); margin-bottom: 4px;">Members:</div>
                <div id="compactMembersList" style="max-height: 120px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;"></div>
              </div>
            </div>
          </div>

          <div id="chatPinnedContainer" style="display:none; border-bottom:1px solid var(--border); background:rgba(90,169,255,.08);"></div>
          
          <div id="chatMessages" class="chat-messages">
            <div class="chat-empty">Select a room to load chat.</div>
          </div>
          <form id="chatForm" class="chat-form">
            <div class="chat-shortcuts">
              <button class="chat-shortcut" type="button" data-template="Heist">🔎 Heist</button>
              <button class="chat-shortcut" type="button" data-template="OC">🔎 OC</button>
              <button class="chat-shortcut" type="button" data-template="MOC">🔎 MOC</button>
              <button class="chat-shortcut" type="button" data-template="Race">🔎 Race</button>
            </div>
            <div class="chat-row" style="position: relative; display: flex; gap: 6px;">
              <textarea id="messageInput" class="input" maxlength="300" placeholder="Write a room message..." style="flex: 1;"></textarea>
              <button id="emojiButton" class="button" type="button" style="padding: 0 10px; font-size: 16px; background: var(--panel-2); border-color: var(--border);" title="Insert Emoji">😀</button>
              
              <!-- Emoji Panel -->
              <div id="emojiPanel" style="display: none; position: absolute; bottom: 100%; right: 0; background: var(--panel-2); border: 1px solid var(--border); border-radius: 10px; padding: 6px; width: 220px; grid-template-columns: repeat(6, 1fr); gap: 4px; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
                <span class="emoji-item">😀</span>
                <span class="emoji-item">😁</span>
                <span class="emoji-item">😂</span>
                <span class="emoji-item">🤣</span>
                <span class="emoji-item">😎</span>
                <span class="emoji-item">😍</span>
                <span class="emoji-item">😘</span>
                <span class="emoji-item">😡</span>
                <span class="emoji-item">😭</span>
                <span class="emoji-item">👍</span>
                <span class="emoji-item">👎</span>
                <span class="emoji-item">✅</span>
                <span class="emoji-item">❌</span>
                <span class="emoji-item">🔥</span>
                <span class="emoji-item">💀</span>
                <span class="emoji-item">🎯</span>
                <span class="emoji-item">🚀</span>
                <span class="emoji-item">💰</span>
                <span class="emoji-item">🔫</span>
                <span class="emoji-item">🛡️</span>
                <span class="emoji-item">🍺</span>
                <span class="emoji-item">💊</span>
              </div>
            </div>
            <div class="chat-row">
              <button class="button" type="submit">Send Message</button>
              <div id="chatFeedback" class="feedback"></div>
            </div>
          </form>
        </aside>
      </div>
    </div>

    <script>
      const roomInput = document.getElementById("roomInput");
      const applyRoomButton = document.getElementById("applyRoomButton");
      const roomTitle = document.getElementById("roomTitle");
      const stateMeta = document.getElementById("stateMeta");
      const rankSortButton = document.getElementById("rankSortButton");
      const obayToggleButton = document.getElementById("obayToggleButton");
      const rankFilterSelect = document.getElementById("rankFilterSelect");
      const myCharacterFilterBtn = document.getElementById("myCharacterFilterBtn");
      const dashboardConnectBtn = document.getElementById("dashboardConnectBtn");
      const nicknamePlayerTR = document.getElementById("nicknamePlayerTR");
      const nicknamePlayerCOM = document.getElementById("nicknamePlayerCOM");
      const nicknamePlayerNL = document.getElementById("nicknamePlayerNL");
      const nicknamePlayerPT = document.getElementById("nicknamePlayerPT");
      const obayMeta = document.getElementById("obayMeta");
      const obayPanelBody = document.getElementById("obayPanelBody");
      const obayTableBody = document.getElementById("obayTableBody");
      const chatMeta = document.getElementById("chatMeta");
      const cooldownTableBody = document.getElementById("cooldownTableBody");
      const chatMessages = document.getElementById("chatMessages");
      const chatForm = document.getElementById("chatForm");
      const messageInput = document.getElementById("messageInput");
      const chatFeedback = document.getElementById("chatFeedback");
      const chatPanelTitle = document.getElementById("chatPanelTitle");
      const dashboardNicknames = { tr: "-", com: "-", nl: "-", pt: "-" };

      const FIXED_ROOM = "General";
      const cooldownColumns = [
        [["crime"], "Crims", "Crims"],
        [["car"], "Car", "Car"],
        [["race"], "Race", "Race"],
        [["heist"], "Heist", "Heist"],
        [["organizedCrime", "organized_crime", "oc"], "Oc", "Organized Crime"],
        [["megaOrganizedCrime", "mega_organized_crime", "megaOc", "mega_oc", "megaoc"], "Moc", "Mega Organized Crime"],
        [["spot"], "Spot", "Spot"],
        [["alcohol"], "Alchol", "Alcohol"],
        [["drugs"], "Drug", "Drugs"],
        [["bullets"], "Bullet", "Bullets"],
        [["assassination"], "Kill", "Assassination"],
        [["blood"], "Blood", "Blood"],
        [["flight"], "Fly", "Flight"]
      ];
      const cooldownUnlockRanks = {
        heist: "Shoplifter",
        organizedcrime: "Thief",
        megaorganizedcrime: "Assassin",
        spot: "Soldier"
      };
      const rankOrder = {
        "0": 0,
        emptysuit: 0,
        deliveryboy: 0,
        picciotto: 1,
        shoplifter: 2,
        pickpocket: 3,
        thief: 4,
        associate: 5,
        mobster: 6,
        soldier: 7,
        swindler: 8,
        assassin: 9,
        localchief: 10,
        chief: 11,
        bruglione: 12,
        godfather: 13,
        firstlady: 13,
        capodecina: 13
      };
      const rankFilterOptions = [
        ["emptysuit", "Empty-suit"],
        ["deliveryboy", "Delivery Boy"],
        ["picciotto", "Picciotto"],
        ["shoplifter", "Shoplifter"],
        ["pickpocket", "Pickpocket"],
        ["thief", "Thief"],
        ["associate", "Associate"],
        ["mobster", "Mobster"],
        ["soldier", "Soldier"],
        ["swindler", "Swindler"],
        ["assassin", "Assassin"],
        ["localchief", "Local Chief"],
        ["chief", "Chief"],
        ["bruglione", "Bruglione"],
        ["godfather", "Godfather"],
        ["firstlady", "First Lady"],
        ["capodecina", "Capodecina"]
      ];

      let currentRoom = "";
      let pollTimer = null;
      let obayPollTimer = null;
      let latestState = null;
      let isConnected = false;
      let myPlayerName = "";
      let myClientId = "";
      let userRoomStatus = "none";
      let isChatAdminOpen = false;
      let lastChatMsgTime = 0;
      let isChatSoundEnabled = true;
      try {
        const stored = localStorage.getItem("omerta_chat_sound_enabled");
        if (stored !== null) {
          isChatSoundEnabled = stored === "true";
        }
      } catch(e){}
      let joinedRooms = ["General"];
      let activeRoom = "General";
      let playerSearchTerm = "";
      let rankSortDirection = 0;
      let selectedRankFilter = "";
      let isMyCharacterFilterActive = false;
      let isObayExpanded = false;
      let activeServerFilter = "";
      let shouldAutoSelectServer = true;
      let activeTemplateState = null;

      // Load initial rooms state from localStorage
      try {
        const storedJoined = localStorage.getItem("omerta_joined_rooms");
        if (storedJoined) {
          const parsedJoined = JSON.parse(storedJoined);
          if (Array.isArray(parsedJoined)) {
            joinedRooms = parsedJoined.filter((room) => typeof room === "string" && room.trim());
          }
        }
        const storedActive = localStorage.getItem("omerta_active_room");
        if (storedActive && typeof storedActive === "string") {
          activeRoom = storedActive.trim() || "General";
        }
        const storedServerFilter = localStorage.getItem("omerta_active_server_filter");
        if (storedServerFilter && storedServerFilter !== "ALL") {
          activeServerFilter = String(storedServerFilter).trim().toLowerCase();
        }
      } catch (err) {
        console.error("Failed to load room settings from localStorage", err);
      }
      
      // Migrate TestRoom to General in joinedRooms and activeRoom
      if (Array.isArray(joinedRooms)) {
        joinedRooms = joinedRooms.map(r => r === "TestRoom" ? "General" : r);
      }
      if (activeRoom === "TestRoom") {
        activeRoom = "General";
      }

      if (!Array.isArray(joinedRooms) || joinedRooms.length === 0) {
        joinedRooms = ["General"];
      }
      if (!joinedRooms.includes("General")) {
        joinedRooms.unshift("General");
      }
      if (!activeRoom || !joinedRooms.includes(activeRoom)) {
        activeRoom = joinedRooms[0];
      }

      function getRoomFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const room = (params.get("room") || "").trim();
        return room || FIXED_ROOM;
      }

      function setRoomInUrl(room) {
        // Keep URL completely clean.
      }

      function isValidRoom(room) {
        return /^[A-Za-z0-9_-]{1,32}$/.test(room);
      }

      function getActiveChatServerId() {
        const normalized = String(activeServerFilter || "").trim().toLowerCase();
        if (["tr", "com", "nl", "pt"].includes(normalized)) {
          return normalized;
        }
        return "tr";
      }

      function isGeneralRoom(room) {
        return String(room || "").trim() === FIXED_ROOM;
      }

      function getChatRoomKey(room) {
        if (!isGeneralRoom(room)) {
          return room;
        }
        return "General_" + getActiveChatServerId().toUpperCase();
      }

      function getChatRoomLabel(room) {
        if (!isGeneralRoom(room)) {
          return room;
        }
        return "General (" + getActiveChatServerId().toUpperCase() + ")";
      }

      function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = String(value);
        return div.innerHTML;
      }

      function parseTemplateChatMessage(value) {
        const normalized = String(value || "").trim();
        const messageWithoutIcon = normalized.startsWith("🔎") ? normalized.slice(2).trim() : normalized;
        const match = messageWithoutIcon.match(/^(heist|race|oc|moc)\\s+(ariyor|looking for|procura|zoekt)\\s*\\(([^()]*)\\)\\s*$/i);
        if (!match) {
          return null;
        }
        return {
          keyword: match[1],
          verb: match[2],
          location: match[3],
        };
      }

      function isTemplateChatMessage(value) {
        return !!parseTemplateChatMessage(value);
      }

      function renderTemplateChatMessage(templateData) {
        return '<span class="chat-template-icon">🔎</span>' +
          '<span class="chat-keyword">' + escapeHtml(templateData.keyword) + '</span> ' +
          escapeHtml(templateData.verb) + ' ' +
          '(<span class="chat-location">' + escapeHtml(String(templateData.location || "").toUpperCase()) + "</span>)";
      }

      function renderChatMessageText(value) {
        const templateData = parseTemplateChatMessage(value);
        if (templateData) {
          return renderTemplateChatMessage(templateData);
        }
        return escapeHtml(value);
      }

      function formatDuration(totalSeconds) {
        const safe = Math.max(0, Math.floor(totalSeconds));
        const hours = Math.floor(safe / 3600);
        const minutes = Math.floor((safe % 3600) / 60);
        const seconds = safe % 60;

        if (hours > 0) {
          return hours + "h " + String(minutes).padStart(2, "0") + "m";
        }

        if (minutes > 0) {
          return String(minutes).padStart(2, "0") + "m " + String(seconds).padStart(2, "0") + "s";
        }

        return seconds + "s";
      }

      function formatUpdated(updatedAt, serverTime) {
        if (!Number.isFinite(updatedAt)) {
          return "-";
        }

        const age = Math.max(0, serverTime - updatedAt);
        return formatDuration(age) + " ago";
      }

      function resolveCooldownValue(value, serverTime) {
        if (!value || typeof value !== "object") {
          return '<span class="muted">-</span>';
        }

        if (value.locked === true) {
          const unlockTitle = "Unlocks at " + (value.unlockRank || "required rank");
          return '<span class="muted" title="' + escapeHtml(unlockTitle) + '">&#128274;</span>';
        }

        if (value.censored === true) {
          return '<span class="muted">***</span>';
        }

        if (value.ready === true || Number(value.timeEnd) === 0) {
          return '<span class="ready" title="READY">✅</span>';
        }

        const timeEnd = Number(value.timeEnd);
        if (!Number.isFinite(timeEnd)) {
          return '<span class="muted">-</span>';
        }

        if (timeEnd <= serverTime) {
          return '<span class="ready" title="READY">✅</span>';
        }

        const remaining = formatDuration(timeEnd - serverTime);
        return '<span class="waiting" title="' + remaining + '">' + remaining + "</span>";
      }

      function normalizeRankKey(value) {
        if (!value) return "";
        const raw = String(value).toLowerCase().trim();
        const translationMap = {
          "dazlak": "emptysuit",
          "boş takım elbise": "emptysuit",
          "bos takim elbise": "emptysuit",
          "kurye": "deliveryboy",
          "tetikçi": "picciotto",
          "tetikci": "picciotto",
          "hırsız": "shoplifter",
          "hirsiz": "shoplifter",
          "dükkan hırsızı": "shoplifter",
          "dukkan hirsizi": "shoplifter",
          "yankesici": "pickpocket",
          "uzman hırsız": "thief",
          "uzman hirsiz": "thief",
          "ortak": "associate",
          "haydut": "mobster",
          "asker": "soldier",
          "dolandırıcı": "swindler",
          "dolandirici": "swindler",
          "suikastçi": "assassin",
          "suikastçı": "assassin",
          "suikastci": "assassin",
          "yerel şef": "localchief",
          "yerel sef": "localchief",
          "şef": "chief",
          "sef": "chief",
          "baba": "godfather",
          "first lady": "firstlady",
          "capodecina": "capodecina",
          "winkeldief": "shoplifter",
          "zakkenroller": "pickpocket",
          "inbreker": "thief",
          "oplichter": "swindler",
          "mão-de-ferro": "emptysuit",
          "sem terno": "emptysuit",
          "estafeta": "deliveryboy",
          "ladrão de lojas": "shoplifter",
          "carteirista": "pickpocket",
          "batedor de carteiras": "pickpocket",
          "ladrão": "thief",
          "associado": "associate",
          "ganster": "mobster",
          "gangster": "mobster",
          "soldado": "soldier",
          "vigarista": "swindler",
          "assassino": "assassin",
          "chefe local": "localchief",
          "chefe": "chief",
          "padrinho": "godfather"
        };
        if (Object.prototype.hasOwnProperty.call(translationMap, raw)) {
          return translationMap[raw];
        }
        return raw.replace(/[\\s_-]+/g, "").replace(/[^a-z0-9]/g, "");
      }

      function getRankOrderValue(rank) {
        const normalized = normalizeRankKey(rank);
        if (!normalized || !Object.prototype.hasOwnProperty.call(rankOrder, normalized)) {
          return null;
        }
        return rankOrder[normalized];
      }

      function getCooldownUnlockRank(keys) {
        const primaryKey = normalizeRankKey(Array.isArray(keys) && keys.length > 0 ? keys[0] : "");
        return cooldownUnlockRanks[primaryKey] || "";
      }

      function renderCooldownCell(entry, keys, fullLabel, serverTime) {
        const unlockRank = getCooldownUnlockRank(keys);
        if (unlockRank) {
          const playerRankValue = getRankOrderValue(entry && entry.progression ? entry.progression.rank : "");
          const unlockRankValue = getRankOrderValue(unlockRank);
          if (playerRankValue !== null && unlockRankValue !== null && playerRankValue < unlockRankValue) {
            const unlockTitle = "Unlocks at " + unlockRank;
            return '<td title="' + escapeHtml(unlockTitle) + '"><span class="muted" title="' + escapeHtml(unlockTitle) + '">&#128274;</span></td>';
          }
        }

        return '<td title="' + escapeHtml(fullLabel) + '">' + resolveCooldownValue(getCooldownRawValue(entry.cooldowns, keys), serverTime) + "</td>";
      }

      function getCooldownRawValue(cooldowns, keys) {
        if (!cooldowns || typeof cooldowns !== "object") {
          return null;
        }

        for (const key of keys) {
          if (Object.prototype.hasOwnProperty.call(cooldowns, key)) {
            return cooldowns[key];
          }
        }

        return null;
      }

      function applyPlayerFilters(players) {
        let result = players.slice();
        const searchValue = playerSearchTerm.trim().toLowerCase();

        if (searchValue) {
          result = result.filter((entry) => {
            return String(entry.player || "").toLowerCase().includes(searchValue);
          });
        }

        if (activeServerFilter && activeServerFilter !== "ALL") {
          result = result.filter((entry) => {
            return (entry.serverId || "").toLowerCase() === activeServerFilter.toLowerCase();
          });
        }

        if (isMyCharacterFilterActive) {
          if (myPlayerName) {
            result = result.filter((entry) => {
              return String(entry.player || "").toLowerCase().trim() === myPlayerName.toLowerCase().trim();
            });
          } else {
            return [];
          }
        } else if (selectedRankFilter) {
          result = result.filter((entry) => {
            const progression = entry && entry.progression && typeof entry.progression === "object" ? entry.progression : {};
            const norm = normalizeRankKey(progression.rank || "");
            console.log("[Rank Filter Debug] Player:", entry.player, "Raw Rank:", progression.rank, "Normalized:", norm, "Selected Filter:", selectedRankFilter, "Match:", norm === selectedRankFilter);
            return norm === selectedRankFilter;
          });
        }

        if (rankSortDirection !== 0) {
          result.sort((a, b) => {
            const rankA = String((a.progression && a.progression.rank) || "").toLowerCase();
            const rankB = String((b.progression && b.progression.rank) || "").toLowerCase();
            const compare = rankA.localeCompare(rankB);
            if (compare !== 0) {
              return compare * rankSortDirection;
            }

            return String(a.player || "").localeCompare(String(b.player || ""));
          });
        } else {
          result.sort((a, b) => String(a.player || "").localeCompare(String(b.player || "")));
        }

        return result;
      }

      function updateRankSortButton() {
        if (rankSortDirection === 0) {
          rankSortButton.classList.remove("active");
          rankSortButton.textContent = "Rank";
          return;
        }

        rankSortButton.classList.add("active");
        rankSortButton.textContent = rankSortDirection > 0 ? "Rank â†‘" : "Rank â†“";
      }

      function populateRankFilterOptions() {
        if (!rankFilterSelect) return;
        rankFilterSelect.innerHTML = ['<option value="">All ranks</option>'].concat(
          rankFilterOptions.map(([value, label]) => '<option value="' + escapeHtml(value) + '">' + escapeHtml(label) + "</option>")
        ).join("");
      }

      function updateObayToggleButton() {
        obayToggleButton.textContent = isObayExpanded ? "Obay Auctions ▼" : "Obay Auctions ▶";
        obayPanelBody.className = isObayExpanded ? "obay-panel-body" : "obay-panel-body collapsed";
      }

      updateObayToggleButton = ((original) => function() {
        original();
        obayToggleButton.textContent = isObayExpanded ? "Obay Auctions \u25BC" : "Obay Auctions \u25B6";
      })(updateObayToggleButton);

      function updateServerCards(stateData) {
        const serverCounts = { tr: 0, com: 0, nl: 0, pt: 0 };
        if (stateData && Array.isArray(stateData.players)) {
          stateData.players.forEach(player => {
            const srv = (player.serverId || "").toLowerCase();
            if (serverCounts[srv] !== undefined && !player.offline) {
              serverCounts[srv]++;
            }
          });
        }

        updateNicknameCardsFromState(stateData);

        const servers = ["tr", "com", "nl", "pt"];
        servers.forEach(srv => {
          const count = serverCounts[srv];
          const cardEl = document.getElementById("card-" + srv);
          const nameEl = document.getElementById("name-" + srv);
          if (cardEl && nameEl) {
            nameEl.textContent = srv.toUpperCase() + " (" + count + ")";
            if (count > 0) {
              cardEl.classList.remove("no-players");
              cardEl.classList.add("has-players");
            } else {
              cardEl.classList.remove("has-players");
              cardEl.classList.add("no-players");
            }
          }
        });
      }

      const SERVER_QUICK_LINKS = {
        pt: {
          crims: "https://omerta.pt/index.php#/?module=Crimes",
          car: "https://omerta.pt/index.php#/?module=Cars",
          smuggling: "https://omerta.pt/index.php#/smuggling.php",
          groupCrimes: "https://omerta.pt/index.php#/?module=GroupCrimes",
          races: "https://omerta.pt/index.php#/races.php",
          bullet: "https://omerta.pt/index.php#/bullets2.php",
          kill: "https://omerta.pt/index.php#/?module=Detectives",
          hospital: "https://omerta.pt/index.php#/?module=Bloodbank",
          fly: "https://omerta.pt/index.php#/?module=Travel",
          market: "https://omerta.pt/index.php#/?module=Shop&action=display_section&id=0",
          garage: "https://omerta.pt/index.php#/garage.php"
        },
        com: {
          crims: "https://barafranca.com/#/?module=Crimes",
          car: "https://barafranca.com/#/?module=Cars",
          smuggling: "https://barafranca.com/#/smuggling.php",
          groupCrimes: "https://barafranca.com/#/?module=GroupCrimes",
          races: "https://barafranca.com/#/races.php",
          bullet: "https://barafranca.com/#/bullets2.php",
          kill: "https://barafranca.com/#/?module=Detectives",
          hospital: "https://barafranca.com/#/?module=Bloodbank",
          fly: "https://barafranca.com/#/?module=Travel",
          market: "https://barafranca.com/#/?module=Shop&action=display_section&id=0",
          garage: "https://barafranca.com/#/garage.php"
        },
        tr: {
          crims: "https://omerta.com.tr/index.php#/?module=Crimes",
          car: "https://omerta.com.tr/index.php#/?module=Cars",
          smuggling: "https://omerta.com.tr/index.php#/smuggling.php",
          groupCrimes: "https://omerta.com.tr/index.php#/?module=GroupCrimes",
          races: "https://omerta.com.tr/index.php#/races.php",
          bullet: "https://omerta.com.tr/index.php#/bullets2.php",
          kill: "https://omerta.com.tr/index.php#/?module=Detectives",
          hospital: "https://omerta.com.tr/index.php#/?module=Bloodbank",
          fly: "https://omerta.com.tr/index.php#/?module=Travel",
          market: "https://omerta.com.tr/index.php#/?module=Shop&action=display_section&id=0",
          garage: "https://omerta.com.tr/index.php#/garage.php"
        },
        nl: {
          crims: "https://barafranca.nl/#/?module=Crimes",
          car: "https://barafranca.nl/#/?module=Cars",
          smuggling: "https://barafranca.nl/#/smuggling.php",
          groupCrimes: "https://barafranca.nl/#/?module=GroupCrimes",
          races: "https://barafranca.nl/#/races.php",
          bullet: "https://barafranca.nl/#/bullets2.php",
          kill: "https://barafranca.nl/#/?module=Detectives",
          hospital: "https://barafranca.nl/?module=Bloodbank",
          fly: "https://barafranca.nl/#/?module=Travel",
          market: "https://barafranca.nl/#/?module=Shop&action=display_section&id=0",
          garage: "https://barafranca.nl/#/garage.php"
        }
      };

      function updateQuickLinks() {
        const srv = (activeServerFilter || "pt").toLowerCase();
        const links = SERVER_QUICK_LINKS[srv] || SERVER_QUICK_LINKS["pt"];
        const keys = [
          "crims", "car", "smuggling", "groupCrimes", "races",
          "bullet", "kill", "hospital", "fly", "market", "garage"
        ];
        keys.forEach(key => {
          const el = document.getElementById("link-" + key);
          if (el) {
            el.href = links[key] || "#";
          }
        });
      }

      function updateActiveCardHighlight() {
        updateQuickLinks();
        const servers = ["tr", "com", "nl", "pt"];
        servers.forEach(srv => {
          const cardEl = document.getElementById("card-" + srv);
          if (cardEl) {
            if (srv === activeServerFilter) {
              cardEl.classList.add("active");
            } else {
              cardEl.classList.remove("active");
            }
          }
        });
      }

      function getPlayerProfileBaseUrl(serverId) {
        const srv = (serverId || activeServerFilter || "tr").toLowerCase();

        if (srv === "tr") {
          return "https://omerta.com.tr/index.php#./user.php?page=user&nick=";
        }
        if (srv === "com") {
          return "https://barafranca.com/#./user.php?page=user&nick=";
        }
        if (srv === "nl") {
          return "https://barafranca.nl/index.php#./user.php?page=user&nick=";
        }
        if (srv === "pt") {
          return "https://omerta.pt/index.php#./user.php?page=user&nick=";
        }

        return "https://omerta.com.tr/index.php#./user.php?page=user&nick=";
      }

      function getInformationPageUrl(serverId) {
        const srv = String(serverId || "").trim().toLowerCase();
        if (srv === "tr") return "https://omerta.com.tr/index.php#/information.php";
        if (srv === "com") return "https://barafranca.com/index.php#/information.php";
        if (srv === "nl") return "https://barafranca.nl/index.php#/information.php";
        if (srv === "pt") return "https://omerta.pt/index.php#/information.php";
        return "#";
      }

      function updateNicknameCards() {
        if (nicknamePlayerTR) nicknamePlayerTR.textContent = dashboardNicknames.tr || "-";
        if (nicknamePlayerCOM) nicknamePlayerCOM.textContent = dashboardNicknames.com || "-";
        if (nicknamePlayerNL) nicknamePlayerNL.textContent = dashboardNicknames.nl || "-";
        if (nicknamePlayerPT) nicknamePlayerPT.textContent = dashboardNicknames.pt || "-";
      }

      function updateNicknameCardsFromState(stateData) {
        if (!stateData || !Array.isArray(stateData.players)) {
          updateNicknameCards();
          return;
        }

        ["tr", "com", "nl", "pt"].forEach((srv) => {
          if (dashboardNicknames[srv] && dashboardNicknames[srv] !== "-") {
            return;
          }
          const match = stateData.players.find((player) => String(player.serverId || "").toLowerCase() === srv && player.player);
          if (match) {
            dashboardNicknames[srv] = match.player;
          }
        });

        updateNicknameCards();
      }

      function selectServer(srv) {
        activeServerFilter = srv;
        try {
          localStorage.setItem("omerta_active_server_filter", activeServerFilter);
        } catch(e){}
        updateActiveCardHighlight();
        if (isGeneralRoom(currentRoom)) {
          lastChatMsgTime = 0;
        }
        if (latestState) {
          renderPlayers(latestState);
        }
        loadStateAndChat();
        loadObay();
      }

      function renderNotesAndTargets(state) {
        if (!state) return;
        const targets = state.targets || [];
        const notes = state.notes || [];

        // Update header button counters
        const targetsCountEl = document.getElementById('targetsCount');
        if (targetsCountEl) targetsCountEl.textContent = targets.length;
        const notesCountEl = document.getElementById('notesCount');
        if (notesCountEl) notesCountEl.textContent = notes.length;

        // Render Targets
        const targetsListContainer = document.getElementById('targetsListContainer');
        if (targetsListContainer) {
          targetsListContainer.style.display = 'flex';
          targetsListContainer.style.flexDirection = 'column';
          targetsListContainer.style.gap = '5px';
          if (targets.length === 0) {
            targetsListContainer.innerHTML = '<span class="muted" style="font-size: 11px; padding: 4px 0;">No targets added yet.</span>';
          } else {
            targetsListContainer.innerHTML = targets.map((t) => {
              const targetProfileUrl = getPlayerProfileBaseUrl(activeServerFilter) + encodeURIComponent(t.name);
              const isDead = !!t.dead;
              const deadClass = isDead ? ' is-dead' : '';
              const skullClass = isDead ? ' is-dead' : '';
              const skullTitle = isDead ? 'Canl\u0131 olarak i\u015faretle' : '\u00d6ld\u00fc olarak i\u015faretle';
              return '<div class="target-item' + deadClass + '">' +
                '<div class="target-info">' +
                '<a class="target-name" href="' + escapeHtml(targetProfileUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(t.name) + '</a>' +
                '<span class="added-by-badge">\ud83d\udc64 ' + escapeHtml(t.addedBy) + '</span>' +
                '</div>' +
                '<div class="target-actions">' +
                '<button type="button" class="skull-btn' + skullClass + '" data-target-id="' + escapeHtml(t.id) + '" onclick="toggleTargetDead(this.dataset.targetId)" title="' + skullTitle + '">💀</button>' +
'<button type="button" class="delete-btn" data-target-id="' + escapeHtml(t.id) + '" onclick="deleteTarget(this.dataset.targetId)" title="Sil">✕</button>' +
                '</div>' +
                '</div>';
            }).join('');
          }
        }

        // Render Notes
        const notesListContainer = document.getElementById('notesListContainer');
        if (notesListContainer) {
          if (notes.length === 0) {
            notesListContainer.innerHTML = '<span class="muted" style="font-size: 11px; padding: 4px 0;">No notes added yet.</span>';
          } else {
            notesListContainer.innerHTML = notes.map((n) => {
              return '<div class="note-item">' +
                '<div class="note-info">' +
                '<span class="note-text">' + escapeHtml(n.text) + '</span>' +
                '<span class="added-by-badge">\ud83d\udc64 ' + escapeHtml(n.addedBy) + '</span>' +
                '</div>' +
                '<button type="button" class="delete-btn" data-note-id="' + escapeHtml(n.id) + '" onclick="deleteNote(this.dataset.noteId)" title="Sil">✕</button>' +
                '</div>';
            }).join('');
          }
        }
      }

      function renderPlayers(state) {
        updateServerCards(state);
        updateActiveCardHighlight();

        if (myCharacterFilterBtn) {
          myCharacterFilterBtn.textContent = myPlayerName ? "Character: " + myPlayerName : "Character: -";
        }

        if (!state || !Array.isArray(state.players) || state.players.length === 0) {
          cooldownTableBody.innerHTML = '<tr><td colspan="20" class="muted">No player data for this room yet.</td></tr>';
          return;
        }

        const filteredPlayers = applyPlayerFilters(state.players);
        if (filteredPlayers.length === 0) {
          cooldownTableBody.innerHTML = '<tr><td colspan="20" class="muted">No players match this search.</td></tr>';
          return;
        }

        const rows = filteredPlayers
          .map((entry) => {
            const rowClass = entry.offline ? "player-offline" : "";
            const status = entry.offline
              ? '<span class="status-dot offline" aria-label="Offline"></span>'
              : '<span class="status-dot online" aria-label="Online"></span>';
            const progression = entry.progression && typeof entry.progression === "object" ? entry.progression : {};
            const cells = cooldownColumns.map(([keys, shortLabel, fullLabel]) => {
              return renderCooldownCell(entry, keys, fullLabel, state.serverTime);
            }).join("");
            const rank = progression.rank || "-";
            let progressionPercent = progression.progressionPercent || "-";
            let activityPercent = progression.activityPercent || "-";
            const platingLabel = progression.platingLabel || "";
            const platingPercent = progression.platingPercent || "";

            if (currentRoom.toLowerCase() === "general") {
              progressionPercent = "***";
              activityPercent = "***";
            }

            let platingHtml = '<span class="muted">-</span>';
            if (platingLabel) {
              const labelLower = platingLabel.toLowerCase();
              let tierClass = "plating-none";
              if (labelLower.includes("very high")) {
                tierClass = "plating-very-high";
              } else if (labelLower.includes("very low")) {
                tierClass = "plating-very-low";
              } else if (labelLower.includes("high")) {
                tierClass = "plating-high";
              } else if (labelLower.includes("medium")) {
                tierClass = "plating-medium";
              } else if (labelLower.includes("low")) {
                tierClass = "plating-low";
              } else if (labelLower.includes("none")) {
                tierClass = "plating-none";
              }
              const tooltip = (platingPercent && currentRoom.toLowerCase() !== "general") ? 'title="' + escapeHtml(platingPercent) + '"' : '';
              platingHtml = '<span class="' + tierClass + '" ' + tooltip + '>' + escapeHtml(platingLabel) + '</span>';
            }

            const profileTooltip = "Rank: " + rank;
            const playerProfileUrl = getPlayerProfileBaseUrl(entry.serverId) + encodeURIComponent(entry.player || "");
            const playerNameHtml = '<a class="text-cell player-name" href="' + escapeHtml(playerProfileUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(entry.player || "-") + "</a>";

            return '<tr class="' + rowClass + '">' +
              '<td title="' + (entry.offline ? "Offline" : "Online") + '">' + status + "</td>" +
              '<td title="' + escapeHtml(entry.player || "-") + '">' + playerNameHtml + "</td>" +
              '<td title="' + escapeHtml(profileTooltip) + '"><span class="text-cell rank-name">' + escapeHtml(rank) + "</span></td>" +
              '<td title="' + escapeHtml(progressionPercent) + '">' + escapeHtml(progressionPercent) + "</td>" +
              '<td title="' + escapeHtml(activityPercent) + '">' + escapeHtml(activityPercent) + "</td>" +
              '<td>' + platingHtml + '</td>' +
              cells +
              '<td title="' + formatUpdated(Number(entry.updatedAt), state.serverTime) + '">' + formatUpdated(Number(entry.updatedAt), state.serverTime) + "</td>" +
              "</tr>";
          });

        cooldownTableBody.innerHTML = rows.join("");
        renderNotesAndTargets(state);
      }

      function renderObay(data) {
        if (!data || !Array.isArray(data.items) || data.items.length === 0) {
          obayTableBody.innerHTML = '<tr><td colspan="5" class="muted">No Obay data yet. Open Obay auctions page with the extension enabled.</td></tr>';
          obayMeta.textContent = "No Obay data loaded.";
          return;
        }

        function formatObayItemName(name) {
          const rawName = String(name || "");
          const normalized = rawName.toLowerCase();
          if (normalized.includes("pak met kogels")) {
            return "Bullet";
          }

          return rawName || "-";
        }

        const rows = data.items.map((item) => {
          const displayName = formatObayItemName(item.name);
          const endValue = String(item.endTime || "-");
          const showClick = endValue.toLowerCase() === "now";
          const endCell = showClick
            ? '<span class="inline-action"><span>' + escapeHtml(endValue) + '</span><a class="mini-link-button" href="https://barafranca.nl/#/?module=Obay&action=auctions" target="_blank" rel="noopener noreferrer">Click</a></span>'
            : escapeHtml(endValue);
          return "<tr>" +
            '<td title="' + escapeHtml(item.name || "-") + '">' + escapeHtml(displayName) + "</td>" +
            '<td title="' + escapeHtml(item.seller || "-") + '">' + escapeHtml(item.seller || "-") + "</td>" +
            '<td title="' + escapeHtml(item.minimumBid || "-") + '">' + escapeHtml(item.minimumBid || "-") + "</td>" +
            '<td title="' + escapeHtml(item.bidder || "-") + '">' + escapeHtml(item.bidder || "-") + "</td>" +
            '<td title="' + escapeHtml(endValue) + '">' + endCell + "</td>" +
            "</tr>";
        });

        obayTableBody.innerHTML = rows.join("");
        obayMeta.textContent = "Updated by " + (data.updatedBy || "-") + " at " + formatClock(Number(data.updatedAt)) + ".";
      }

      function formatClock(timestamp) {
        if (!Number.isFinite(timestamp)) {
          return "-";
        }

        return new Date(timestamp * 1000).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        });
      }

      function renderChat(room, messages) {
        const currentSender = getChatSender();

        let hasNewMessage = false;
        if (messages && messages.length > 0) {
          const lastMsg = messages[messages.length - 1];
          const lastTime = Number(lastMsg.createdAt) || 0;
          if (lastChatMsgTime > 0 && lastTime > lastChatMsgTime) {
            if (lastMsg.player !== currentSender) {
              hasNewMessage = true;
            }
          }
          lastChatMsgTime = lastTime;
        }

        // Pinned Messages List Update
        const pinnedMessages = messages.filter(m => m.pinned);
        const pinnedContainer = document.getElementById("chatPinnedContainer");

        if (pinnedContainer) {
          if (pinnedMessages.length > 0) {
            pinnedContainer.style.display = "block";
            pinnedContainer.innerHTML = pinnedMessages.map((msg) => {
              const cleanText = String(msg.message || "").replace(/<\\/?[^>]+(>|$)/g, "");
              return '<div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:4px 8px; border-bottom:1px solid rgba(255,255,255,.05); font-size:11px;">' +
                '<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text);">📌 <b style="color:var(--yellow);">' + escapeHtml(msg.player || "-") + ':</b> ' + escapeHtml(cleanText) + '</span>' +
                '<button type="button" class="delete-btn" data-msg-id="' + escapeHtml(msg.id || "") + '" onclick="togglePinMessage(this.dataset.msgId)" title="Unpin">✕</button>' +
                '</div>';
            }).join("");
          } else {
            pinnedContainer.style.display = "none";
            pinnedContainer.innerHTML = "";
          }
        }

        chatMessages.innerHTML = messages.map((message) => {
          const timeStr = formatClock(Number(message.createdAt));

          // System notification messages (target dead/alive events)
          if (message.system) {
            const isDead = String(message.message || '').includes('DEAD');
            const sysBg = isDead
              ? 'rgba(255,107,107,0.10)'
              : 'rgba(51,209,122,0.10)';
            const sysBorder = isDead
              ? 'rgba(255,107,107,0.35)'
              : 'rgba(51,209,122,0.35)';
            const sysColor = isDead ? 'var(--red)' : 'var(--green)';
            return '<div class="chat-item system-event" data-msg-id="' + (message.id || '') + '" style="' +
              'display: flex; align-items: center; justify-content: center; gap: 6px;' +
              'margin: 4px 0; padding: 5px 10px; border-radius: 8px;' +
              'background: ' + sysBg + '; border: 1px solid ' + sysBorder + ';' +
              'text-align: center;">' +
              '<span style="font-size: 11px; font-weight: 700; color: ' + sysColor + ';">' + escapeHtml(message.message || '') + '</span>' +
              '<span style="font-size: 9px; color: var(--muted); flex-shrink: 0;">' + escapeHtml(timeStr) + '</span>' +
              '</div>';
          }

          // Resolve per-player serverId from live state for accurate profile URL
          let playerServerId = activeServerFilter;
          if (latestState && Array.isArray(latestState.players)) {
            const stateEntry = latestState.players.find(function(p) {
              return p.player === message.player;
            });
            if (stateEntry && stateEntry.serverId) {
              playerServerId = stateEntry.serverId;
            }
          }

          const isOwn = message.player === currentSender;
          const rawMessageText = String(message.message || "");
          const isTemplateMessage = isTemplateChatMessage(rawMessageText);
          const bubbleClass = (isOwn ? "own" : "other") + (isTemplateMessage ? " template-message" : "");
          const playerName = escapeHtml(message.player || "-");
          const playerProfileUrl = getPlayerProfileBaseUrl(playerServerId) + encodeURIComponent(message.player || "");
          const msgText = renderChatMessageText(rawMessageText);

          // Server badge next to player name
          const srvBadgeColor = { tr: '#e06c75', com: '#61afef', nl: '#e5c07b', pt: '#98c379' };
          const srvColor = srvBadgeColor[playerServerId] || 'var(--muted)';
          const serverBadge = '<span style="font-size: 8px; font-weight: 800; color: ' + srvColor + '; opacity: 0.85; margin-right: 3px; vertical-align: middle; letter-spacing: 0.3px;">' + escapeHtml(playerServerId.toUpperCase()) + '</span>';
          
          const replyBtn = isOwn ? "" : '<button type="button" class="chat-reply-button" data-player="' + playerName + '">Yanitla</button>';
          const pinText = message.pinned ? "📍 Unpin" : "📌 Pin";
          const pinBtn = '<button type="button" class="chat-pin-button" data-msg-id="' + (message.id || "") + '">' + pinText + '</button>';
          const chatActions = '<div class="chat-actions">' + replyBtn + (replyBtn ? " | " : "") + pinBtn + '</div>';

          const pinIndicator = message.pinned ? ' <span style="color: var(--yellow); font-size: 9px;" title="Pinned Message">📌</span>' : '';
          
          return '<div class="chat-item ' + bubbleClass + '" data-msg-id="' + (message.id || "") + '">' +
            '<div class="chat-content">' +
            serverBadge +
            '<a class="chat-player" href="' + escapeHtml(playerProfileUrl) + '" target="_blank" rel="noopener noreferrer" title="Open profile">' + escapeHtml(playerName) + ':</a>' +
            '<span class="chat-text">' + msgText + '</span>' +
            pinIndicator +
            '</div>' +
            '<div class="chat-meta-row">' +
            chatActions +
            '<span class="chat-time">' + escapeHtml(timeStr) + '</span>' +
            '</div>' +
            '</div>';
        }).join("");

        chatMessages.scrollTop = chatMessages.scrollHeight;
        chatMeta.textContent = room + " room chat, " + messages.length + " message(s).";

        if (hasNewMessage && isChatSoundEnabled) {
          const isTabHidden = document.hidden || !document.hasFocus();
          if (isTabHidden) {
            playNotificationSound();
          }
        }
      }

      async function loadObay() {
        if (!currentRoom || !isValidRoom(currentRoom)) {
          obayTableBody.innerHTML = '<tr><td colspan="5" class="muted">No Obay data yet. Open Obay auctions page with the extension enabled.</td></tr>';
          obayMeta.textContent = "No Obay data loaded.";
          return;
        }

        if (userRoomStatus !== "owner" && userRoomStatus !== "member") {
          return;
        }

        try {
          const targetSrv = activeServerFilter === "ALL" ? "nl" : activeServerFilter;
          const response = await fetch("/api/obay?room=" + encodeURIComponent(currentRoom) + "&clientId=" + encodeURIComponent(myClientId) + "&serverId=" + encodeURIComponent(targetSrv));
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Obay request failed");
          }

          renderObay(data);
        } catch (error) {
          obayMeta.textContent = error.message;
          obayTableBody.innerHTML = '<tr><td colspan="5" class="muted">Could not load Obay data.</td></tr>';
        }
      }

      async function loadStateAndChat() {
        if (!currentRoom) {
          roomTitle.textContent = FIXED_ROOM;
          chatPanelTitle.textContent = getChatRoomLabel(FIXED_ROOM);
          stateMeta.textContent = "Online: 0";
          chatMeta.textContent = "No messages loaded.";
          cooldownTableBody.innerHTML = '<tr><td colspan="20" class="muted">No room selected.</td></tr>';
          chatMessages.innerHTML = '<div class="chat-empty">Select a room to load chat.</div>';
          return;
        }

        if (!isValidRoom(currentRoom)) {
          roomTitle.textContent = currentRoom;
          chatPanelTitle.textContent = getChatRoomLabel(currentRoom);
          stateMeta.textContent = "Online: 0";
          cooldownTableBody.innerHTML = '<tr><td colspan="20" class="muted">Invalid room name.</td></tr>';
          chatMessages.innerHTML = '<div class="chat-empty">Invalid room name.</div>';
          return;
        }

        try {
          const statusRes = await fetch("/api/rooms/status?room=" + encodeURIComponent(currentRoom) + "&clientId=" + encodeURIComponent(myClientId));
          const statusData = await statusRes.json();
          userRoomStatus = statusData.status || "none";

          const layoutEl = document.querySelector(".layout");
          const unauthorizedEl = document.getElementById("unauthorizedView");
          const cooldownsPanel = document.getElementById("cooldownsPanel");
          const obayPanel = document.getElementById("obayPanel");
          const chatPanel = document.getElementById("chatPanel");
          const chatAdminPanel = document.getElementById("chatAdminPanel");

          if (userRoomStatus === "owner" || userRoomStatus === "member") {
            layoutEl.style.display = "grid";
            layoutEl.style.gridTemplateColumns = "minmax(0, 2.8fr) minmax(360px, 1.15fr)";
            unauthorizedEl.style.display = "none";
            cooldownsPanel.style.display = "block";
            obayPanel.style.display = "block";
            chatPanel.style.display = "flex";

            const notesPanel = document.getElementById('notesPanel');
            const notesPanelHeaderBtns = document.getElementById('notesPanelHeaderButtons');
            if (notesPanel && notesPanelHeaderBtns) {
              const roomLower = currentRoom.toLowerCase();
              if (roomLower !== 'general' && roomLower !== 'testroom') {
                notesPanelHeaderBtns.style.display = 'flex';
              } else {
                notesPanelHeaderBtns.style.display = 'none';
                notesPanel.style.display = 'none';
                // reset active tab state
                activeNotesTab = null;
                const hTBtn = document.getElementById('headerTargetsBtn');
                const hNBtn = document.getElementById('headerNotesBtn');
                if (hTBtn) { hTBtn.style.borderColor = 'var(--border)'; hTBtn.style.color = 'var(--muted)'; }
                if (hNBtn) { hNBtn.style.borderColor = 'var(--border)'; hNBtn.style.color = 'var(--muted)'; }
              }
            }

            const chatAdminToggleBtn = document.getElementById("chatAdminToggleBtn");
            if (userRoomStatus === "owner") {
              chatAdminToggleBtn.style.display = "inline-block";
              if (isChatAdminOpen) {
                chatAdminPanel.style.display = "block";
                loadAdminData();
              } else {
                chatAdminPanel.style.display = "none";
              }
            } else {
              chatAdminToggleBtn.style.display = "none";
              chatAdminPanel.style.display = "none";
            }

            const stateResponse = await fetch("/api/state?room=" + encodeURIComponent(currentRoom) + "&clientId=" + encodeURIComponent(myClientId));
            const stateData = await stateResponse.json();

            if (!stateResponse.ok) {
              throw new Error(stateData.error || "State request failed");
            }

            latestState = stateData;

            // Resolve and sync nickname for active server if found in state data matching our clientId
            if (myClientId && activeServerFilter) {
              const targetFilter = activeServerFilter.toLowerCase();
              const matchedEntry = stateData.players.find(p => p.clientId === myClientId && (p.serverId || "").toLowerCase() === targetFilter);
              if (matchedEntry && matchedEntry.player) {
                const oldName = myPlayerName;
                myPlayerName = matchedEntry.player;
                if (myPlayerName !== oldName) {
                  updateChatFormState();
                }
                window.postMessage({ type: "OMERTA_SET_PLAYER", player: myPlayerName, serverId: activeServerFilter }, "*");
              }
            }

            roomTitle.textContent = currentRoom;
            stateMeta.textContent = "Online: " + stateData.players.filter((player) => !player.offline).length;

            const servers = ["tr", "com", "nl", "pt"];
            if (shouldAutoSelectServer || !servers.includes(activeServerFilter)) {
              const serverCounts = { tr: 0, com: 0, nl: 0, pt: 0 };
              stateData.players.forEach(player => {
                const srv = (player.serverId || "").toLowerCase();
                if (serverCounts[srv] !== undefined && !player.offline) {
                  serverCounts[srv]++;
                }
              });

              if (servers.includes(activeServerFilter) && serverCounts[activeServerFilter] > 0) {
                // Keep the current active filter
              } else {
                let targetSrv = servers.find(srv => serverCounts[srv] > 0);
                if (!targetSrv) {
                  const anyCounts = { tr: 0, com: 0, nl: 0, pt: 0 };
                  stateData.players.forEach(player => {
                    const srv = (player.serverId || "").toLowerCase();
                    if (anyCounts[srv] !== undefined) {
                      anyCounts[srv]++;
                    }
                  });
                  targetSrv = servers.find(srv => anyCounts[srv] > 0);
                }
                if (!targetSrv) {
                  targetSrv = "tr";
                }
                activeServerFilter = targetSrv;
                try {
                  localStorage.setItem("omerta_active_server_filter", activeServerFilter);
                } catch(e){}
              }
              shouldAutoSelectServer = false;
            }

            const chatRoomKey = getChatRoomKey(currentRoom);
            const chatRoomLabel = getChatRoomLabel(currentRoom);
            const chatResponse = await fetch("/api/chat?room=" + encodeURIComponent(chatRoomKey) + "&clientId=" + encodeURIComponent(myClientId));
            const chatData = await chatResponse.json();

            if (!chatResponse.ok) {
              throw new Error(chatData.error || "Chat request failed");
            }

            renderPlayers(stateData);
            chatPanelTitle.textContent = chatRoomLabel;
            renderChat(chatRoomLabel, chatData.messages);
          } else {
            layoutEl.style.display = "grid";
            layoutEl.style.gridTemplateColumns = "1fr";
            unauthorizedEl.style.display = "block";
            cooldownsPanel.style.display = "none";
            obayPanel.style.display = "none";
            chatPanel.style.display = "none";
            chatAdminPanel.style.display = "none";
            document.getElementById("chatAdminToggleBtn").style.display = "none";

            const titleEl = document.getElementById("unauthorizedTitle");
            const msgEl = document.getElementById("unauthorizedMessage");
            const joinBtn = document.getElementById("unauthorizedJoinBtn");
            const iconEl = document.getElementById("unauthorizedIcon");

            if (userRoomStatus === "pending") {
              iconEl.textContent = "â³";
              titleEl.textContent = "Waiting for Approval";
              msgEl.textContent = "Waiting for owner approval to join " + currentRoom + ".";
              joinBtn.style.display = "none";
            } else {
              iconEl.textContent = "🔒";
              titleEl.textContent = "Access Restricted";
              msgEl.textContent = "You are not a member of " + currentRoom + ".";
              joinBtn.style.display = "inline-block";

              joinBtn.onclick = async () => {
                if (!myClientId || !myPlayerName) {
                  alert("Connect first: player name not detected.");
                  return;
                }
                const res = await fetch("/api/rooms/request-join", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ room: currentRoom, clientId: myClientId, player: myPlayerName })
                });
                const data = await res.json();
                if (res.ok && data.ok) {
                  loadStateAndChat();
                } else {
                  alert(data.error || "Failed to send request.");
                }
              };
            }
            iconEl.textContent = userRoomStatus === "pending" ? "\u23F3" : "\uD83D\uDD12";
          }
        } catch (error) {
          latestState = null;
          roomTitle.textContent = currentRoom || FIXED_ROOM;
          chatPanelTitle.textContent = getChatRoomLabel(currentRoom || FIXED_ROOM);
          stateMeta.textContent = "Failed to load room data.";
          cooldownTableBody.innerHTML = '<tr><td colspan="20" class="muted">Could not load state.</td></tr>';
          chatMessages.innerHTML = '<div class="chat-empty">Could not load chat.</div>';
          chatMeta.textContent = error.message;
        }
      }

      async function loadAdminData() {
        try {
          const [pendingRes, membersRes] = await Promise.all([
            fetch("/api/rooms/pending?room=" + encodeURIComponent(currentRoom) + "&clientId=" + encodeURIComponent(myClientId)),
            fetch("/api/rooms/members?room=" + encodeURIComponent(currentRoom) + "&clientId=" + encodeURIComponent(myClientId))
          ]);
          const pendingData = await pendingRes.json();
          const membersData = await membersRes.json();
          
          const compactPending = document.getElementById("compactPendingList");
          if (pendingData.pending && pendingData.pending.length > 0) {
            compactPending.innerHTML = pendingData.pending.map((p) => {
              return \`<div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 3px 6px; border-radius: 4px;">
                <span title="\${escapeHtml(p.player)}" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70px;">\${escapeHtml(p.player)}</span>
                <div style="display: flex; gap: 2px;">
                  <button class="button" style="padding: 1px 4px; font-size: 9px; background: #2e7d32; border: 0; line-height: 1;" onclick="approveRequest('\${escapeHtml(p.clientId)}')">✓</button>
                  <button class="button" style="padding: 1px 4px; font-size: 9px; background: #c62828; border: 0; line-height: 1;" onclick="rejectRequest('\${escapeHtml(p.clientId)}')">✗</button>
                </div>
              </div>\`;
            }).join("");
          } else {
            compactPending.innerHTML = '<span class="muted" style="font-size: 9px;">None.</span>';
          }
          
          const compactMembers = document.getElementById("compactMembersList");
          if (membersData.members && membersData.members.length > 0) {
            compactMembers.innerHTML = membersData.members.map((m) => {
              const isMe = m.clientId === myClientId;
              const kickBtn = isMe ? "" : \`<button class="button" style="padding: 1px 4px; font-size: 9px; background: #c62828; border: 0; line-height: 1;" onclick="kickMember('\${escapeHtml(m.clientId)}')">Kick</button>\`;
              return \`<div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 3px 6px; border-radius: 4px;">
                <span title="\${escapeHtml(m.player)} (\${m.role})" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 75px; color: \${isMe ? 'var(--yellow)' : 'inherit'}">\${escapeHtml(m.player)}</span>
                \${kickBtn}
              </div>\`;
            }).join("");
          } else {
            compactMembers.innerHTML = '<span class="muted" style="font-size: 9px;">None.</span>';
          }
        } catch (err) {
          console.error("Failed to load admin data", err);
        }
      }

      async function approveRequest(targetClientId) {
        if (!confirm("Approve this player?")) return;
        try {
          const res = await fetch("/api/rooms/approve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ room: currentRoom, clientId: myClientId, targetClientId })
          });
          const data = await res.json();
          if (res.ok && data.ok) {
            loadAdminData();
          } else {
            alert(data.error || "Failed to approve.");
          }
        } catch(e) { alert(e.message); }
      }

      async function rejectRequest(targetClientId) {
        if (!confirm("Reject this request?")) return;
        try {
          const res = await fetch("/api/rooms/reject", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ room: currentRoom, clientId: myClientId, targetClientId })
          });
          const data = await res.json();
          if (res.ok && data.ok) {
            loadAdminData();
          } else {
            alert(data.error || "Failed to reject.");
          }
        } catch(e) { alert(e.message); }
      }

      async function kickMember(targetClientId) {
        if (!confirm("Kick this member?")) return;
        try {
          const res = await fetch("/api/rooms/kick", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ room: currentRoom, clientId: myClientId, targetClientId })
          });
          const data = await res.json();
          if (res.ok && data.ok) {
            loadAdminData();
          } else {
            alert(data.error || "Failed to kick.");
          }
        } catch(e) { alert(e.message); }
      }

      function selectRoom(roomName) {
        if (roomName === activeRoom) return;
        activeRoom = roomName;
        try {
          localStorage.setItem("omerta_active_room", activeRoom);
        } catch(e){}
        renderRoomTabs();
        window.postMessage({ type: "OMERTA_SET_ROOM", room: activeRoom }, "*");
        applyRoom(activeRoom);
      }

      function leaveRoom(event, roomName) {
        event.stopPropagation();
        joinedRooms = joinedRooms.filter(r => r !== roomName);
        try {
          localStorage.setItem("omerta_joined_rooms", JSON.stringify(joinedRooms));
        } catch(e){}
        if (activeRoom === roomName) {
          activeRoom = "General";
          try {
            localStorage.setItem("omerta_active_room", activeRoom);
          } catch(e){}
          window.postMessage({ type: "OMERTA_SET_ROOM", room: activeRoom }, "*");
          applyRoom(activeRoom);
        }
        renderRoomTabs();
      }

      function renderRoomTabs() {
        const container = document.getElementById("roomTabsContainer");
        if (!container) return;
        container.innerHTML = joinedRooms.map((room) => {
          const isActive = room === activeRoom;
          const isDefaultRoom = room === "General";
          const closeButton = isDefaultRoom ? "" : \`<span class="room-tab-close" onclick="leaveRoom(event, '\${escapeHtml(room)}')">×</span>\`;
          const roomLabel = isDefaultRoom ? "General" : room;
          return \`<div class="room-tab \${isActive ? 'active' : ''}" onclick="selectRoom('\${escapeHtml(room)}')">\` +
            \`<span>\${escapeHtml(roomLabel)}</span>\` +
            closeButton +
            \`</div>\`;
        }).join("");
      }

      function startPolling() {
        if (pollTimer) {
          clearInterval(pollTimer);
        }

        if (obayPollTimer) {
          clearInterval(obayPollTimer);
        }

        loadStateAndChat();
        loadObay();
        pollTimer = window.setInterval(loadStateAndChat, 1000);
        obayPollTimer = window.setInterval(loadObay, 5000);
      }

      function applyRoom(room) {
        currentRoom = (room || FIXED_ROOM).trim();
        roomInput.value = currentRoom;
        setRoomInUrl(currentRoom);
        shouldAutoSelectServer = true;
        lastChatMsgTime = 0;
        startPolling();
      }

      roomInput.value = FIXED_ROOM;
      roomInput.readOnly = true;
      applyRoomButton.disabled = true;
      applyRoomButton.textContent = "Locked";
      populateRankFilterOptions();
      updateRankSortButton();
      updateObayToggleButton();
      updateSoundButtonState();

      // Server Filter dropdown removed. Filter state is managed by the sidebar server cards.

      window.handlePlayerProfileSearch = function(event) {
        event.preventDefault();
        const input = document.getElementById("playerSearchInput");
        const val = (input.value || "").trim();
        if (!val) return;

        const baseUrl = getPlayerProfileBaseUrl(activeServerFilter);
        window.open(baseUrl + encodeURIComponent(val), "_blank");
        input.value = "";
      };

      if (dashboardConnectBtn) {
        dashboardConnectBtn.addEventListener("click", () => {
          dashboardConnectBtn.disabled = true;
          stateMeta.textContent = "Connecting open Omerta tabs...";
          window.postMessage({ type: "OMERTA_CONNECT_ALL" }, "*");
          window.setTimeout(() => {
            if (dashboardConnectBtn) {
              dashboardConnectBtn.disabled = false;
            }
          }, 2500);
        });
      }

      isChatAdminOpen = false;
      window.toggleChatAdmin = function() {
        const panel = document.getElementById("chatAdminPanel");
        const btn = document.getElementById("chatAdminToggleBtn");
        isChatAdminOpen = !isChatAdminOpen;
        if (isChatAdminOpen) {
          panel.style.display = "block";
          btn.textContent = "🛡️ Admin (Open)";
          btn.style.borderColor = "var(--yellow)";
          loadAdminData();
        } else {
          panel.style.display = "none";
          btn.textContent = "🛡️ Admin";
          btn.style.borderColor = "var(--border)";
        }
      };

      function playNotificationSound() {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const playBeep = (freq, time, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(freq, time);
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.15, time + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
            osc.start(time);
            osc.stop(time + duration);
          };
          const now = ctx.currentTime;
          playBeep(880, now, 0.12);
          playBeep(1046.5, now + 0.08, 0.25);
        } catch (e) {
          console.error("Audio playback failed", e);
        }
      }

      function updateSoundButtonState() {
        const btn = document.getElementById("chatSoundToggleBtn");
        if (btn) {
          btn.textContent = isChatSoundEnabled ? "🔊 Sound: ON" : "🔇 Sound: OFF";
          btn.style.borderColor = isChatSoundEnabled ? "var(--yellow)" : "var(--border)";
        }
      }

      window.toggleChatSound = function() {
        isChatSoundEnabled = !isChatSoundEnabled;
        try {
          localStorage.setItem("omerta_chat_sound_enabled", String(isChatSoundEnabled));
        } catch(e){}
        updateSoundButtonState();
        if (isChatSoundEnabled) {
          playNotificationSound();
        }
      };

      rankSortButton.addEventListener("click", () => {
        if (rankSortDirection === 0) {
          rankSortDirection = 1;
        } else if (rankSortDirection === 1) {
          rankSortDirection = -1;
        } else {
          rankSortDirection = 0;
        }

        updateRankSortButton();
        if (latestState) {
          renderPlayers(latestState);
        }
      });

      if (rankFilterSelect) {
        rankFilterSelect.addEventListener("change", () => {
          selectedRankFilter = rankFilterSelect.value || "";
          isMyCharacterFilterActive = false;
          if (myCharacterFilterBtn) {
            myCharacterFilterBtn.classList.remove("active");
          }
          if (latestState) {
            renderPlayers(latestState);
          }
        });
      }

      if (myCharacterFilterBtn) {
        myCharacterFilterBtn.addEventListener("click", () => {
          isMyCharacterFilterActive = !isMyCharacterFilterActive;
          if (isMyCharacterFilterActive) {
            myCharacterFilterBtn.classList.add("active");
            selectedRankFilter = "";
            if (rankFilterSelect) {
              rankFilterSelect.value = "";
            }
          } else {
            myCharacterFilterBtn.classList.remove("active");
          }
          if (latestState) {
            renderPlayers(latestState);
          }
        });
      }

      obayToggleButton.addEventListener("click", () => {
        isObayExpanded = !isObayExpanded;
        updateObayToggleButton();
      });

      chatForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        chatFeedback.className = "feedback";
        chatFeedback.textContent = "";

        let message = messageInput.value.trim();
        message = message.replace(/\s*\(\)/g, "").trim();

        if (!isConnected || !myPlayerName) {
          chatFeedback.className = "feedback error";
          chatFeedback.textContent = "Open Omerta and wait for extension to connect.";
          return;
        }

        if (!message) {
          chatFeedback.className = "feedback error";
          chatFeedback.textContent = "Message cannot be empty.";
          return;
        }

        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              room: getChatRoomKey(currentRoom),
              player: myPlayerName,
              clientId: myClientId,
              message
            })
          });

          const resData = await response.json().catch(() => ({ ok: false, error: "Invalid response" }));
          if (!response.ok || !resData.ok) {
            throw new Error(resData.error || "Message send failed");
          }

          clearActiveTemplateState();
          messageInput.value = "";
          chatFeedback.className = "feedback";
          chatFeedback.textContent = "";
          updateChatFormState();
          loadStateAndChat();
        } catch (error) {
          chatFeedback.className = "feedback error";
          chatFeedback.textContent = error.message || "Message send failed";
        }
      });      function getChatSender() {
        return myPlayerName || "";
      }

      function getChatTemplateText(serverId, label) {
        const normalizedServerId = String(serverId || "").trim().toLowerCase();
        if (normalizedServerId === "com") {
          return "🔎 " + label + " Looking for ()";
        }
        if (normalizedServerId === "pt") {
          return "🔎 " + label + " Procura ()";
        }
        if (normalizedServerId === "nl") {
          return "🔎 " + label + " Zoekt ()";
        }
        return "🔎 " + label + " Ariyor ()";
      }

      function buildChatTemplate(label) {
        return getChatTemplateText(getActiveChatServerId(), label);
      }

      function createTemplateState(template) {
        const openIndex = template.indexOf("(");
        const closeIndex = template.lastIndexOf(")");
        if (openIndex < 0 || closeIndex <= openIndex) {
          return null;
        }
        return {
          prefix: template.slice(0, openIndex + 1),
          suffix: template.slice(closeIndex),
        };
      }

      function clearActiveTemplateState() {
        activeTemplateState = null;
      }

      function syncTemplateMessageInput(cursorPosition) {
        if (!activeTemplateState) {
          return;
        }

        const prefix = activeTemplateState.prefix;
        const suffix = activeTemplateState.suffix;
        let innerText = String(messageInput.value || "");

        if (innerText.startsWith(prefix) && innerText.endsWith(suffix) && innerText.length >= prefix.length + suffix.length) {
          innerText = innerText.slice(prefix.length, innerText.length - suffix.length);
        } else {
          const fallbackOpen = innerText.indexOf("(");
          const fallbackClose = innerText.lastIndexOf(")");
          if (fallbackOpen >= 0 && fallbackClose > fallbackOpen) {
            innerText = innerText.slice(fallbackOpen + 1, fallbackClose);
          }
        }

        innerText = innerText.replace(/[()]/g, "").replace(/\\s+/g, " ").trim().toUpperCase();
        messageInput.value = prefix + innerText + suffix;

        const minPos = prefix.length;
        const maxPos = prefix.length + innerText.length;
        const nextPos = Math.max(minPos, Math.min(maxPos, Number(cursorPosition) || maxPos));
        messageInput.selectionStart = messageInput.selectionEnd = nextPos;
      }

      window.insertChatTemplate = function(label) {
        const template = buildChatTemplate(label);
        activeTemplateState = createTemplateState(template);
        messageInput.value = template;
        messageInput.focus();
        syncTemplateMessageInput(template.indexOf("(") + 1);
      };

      window.replyToChatMessage = function(playerName) {
        const safePlayerName = String(playerName || "").trim();
        if (!safePlayerName) return;
        clearActiveTemplateState();
        messageInput.value = "+ " + safePlayerName + " ";
        messageInput.focus();
        messageInput.selectionStart = messageInput.selectionEnd = messageInput.value.length;
      };

      function updateChatFormState() {
        const sendBtn = chatForm.querySelector("button[type='submit']");
        const emojiBtn = document.getElementById("emojiButton");
        const shortcutButtons = document.querySelectorAll(".chat-shortcut");
        if (isConnected && myPlayerName) {
          messageInput.disabled = false;
          if (sendBtn) sendBtn.disabled = false;
          if (emojiBtn) emojiBtn.disabled = false;
          shortcutButtons.forEach((button) => { button.disabled = false; });
          chatFeedback.className = "feedback success";
          chatFeedback.textContent = "Connected as " + myPlayerName;
        } else {
          messageInput.disabled = true;
          if (sendBtn) sendBtn.disabled = true;
          if (emojiBtn) emojiBtn.disabled = true;
          shortcutButtons.forEach((button) => { button.disabled = true; });
          chatFeedback.className = "feedback error";
          chatFeedback.textContent = "Open Omerta and wait for extension to connect.";
        }
      }

      // Handshake and postMessage coordination with extension
      window.addEventListener("message", (event) => {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || typeof data !== "object") return;

        if (data.type === "OMERTA_IDENTITY") {
          const wasConnected = isConnected;
          const oldName = myPlayerName;
          const oldClientId = myClientId;
          const responseServerId = String(data.serverId || "").trim().toLowerCase();
          if (["tr", "com", "nl", "pt"].includes(responseServerId)) {
            dashboardNicknames[responseServerId] = data.player || "-";
            updateNicknameCards();
          }
          
          const isActiveServer = responseServerId === getActiveChatServerId();
          if (isActiveServer) {
            isConnected = data.connected;
            myPlayerName = data.player || "";
            myClientId = data.clientId || "";
            
            if (isConnected !== wasConnected || myPlayerName !== oldName || myClientId !== oldClientId) {
              updateChatFormState();
              if (latestState) {
                renderPlayers(latestState);
              }
            }
          }
          
          if (data.room !== activeRoom) {
            window.postMessage({ type: "OMERTA_SET_ROOM", room: activeRoom }, "*");
          }
        } else if (data.type === "OMERTA_CONNECT_RESULT") {
          if (dashboardConnectBtn) {
            dashboardConnectBtn.disabled = false;
          }
          if (data.ok) {
            stateMeta.textContent = "Connect sent to " + (Number(data.count) || 0) + " tab(s).";
          } else {
            stateMeta.textContent = data.error || "Connect failed.";
          }
        }
      });

      // Poll connection status
      window.setInterval(() => {
        window.postMessage({ type: "OMERTA_GET_IDENTITY", serverId: activeServerFilter }, "*");
        ["tr", "com", "nl", "pt"].forEach((srv) => {
          window.postMessage({ type: "OMERTA_GET_IDENTITY", serverId: srv }, "*");
        });
      }, 1000);
      window.postMessage({ type: "OMERTA_GET_IDENTITY", serverId: activeServerFilter }, "*");
      ["tr", "com", "nl", "pt"].forEach((srv) => {
        window.postMessage({ type: "OMERTA_GET_IDENTITY", serverId: srv }, "*");
      });
      updateNicknameCards();

      // Custom Emoji Panel interaction
      const emojiButton = document.getElementById("emojiButton");
      const emojiPanel = document.getElementById("emojiPanel");

      function insertEmoji(emoji) {
        const start = messageInput.selectionStart;
        const end = messageInput.selectionEnd;
        const text = messageInput.value;
        messageInput.value = text.substring(0, start) + emoji + text.substring(end);
        messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;
        messageInput.focus();
      }

      emojiButton.addEventListener("click", (event) => {
        event.stopPropagation();
        if (emojiPanel.style.display === "grid") {
          emojiPanel.style.display = "none";
        } else {
          emojiPanel.style.display = "grid";
        }
      });

      emojiPanel.addEventListener("click", (event) => {
        const item = event.target.closest(".emoji-item");
        if (item) {
          insertEmoji(item.textContent);
          emojiPanel.style.display = "none";
        }
        event.stopPropagation();
      });

      document.addEventListener("click", () => {
        emojiPanel.style.display = "none";
      });

      document.querySelectorAll(".chat-shortcut").forEach((button) => {
        button.addEventListener("click", () => {
          insertChatTemplate(button.dataset.template || "");
        });
      });

      // Keydown interaction (Enter sends, Shift+Enter newlines)
      messageInput.addEventListener("keydown", (event) => {
        if (activeTemplateState) {
          const prefixLength = activeTemplateState.prefix.length;
          const suffixLength = activeTemplateState.suffix.length;
          const editableEnd = messageInput.value.length - suffixLength;
          const selectionStart = messageInput.selectionStart || 0;
          const selectionEnd = messageInput.selectionEnd || 0;

          if (event.key === "Backspace" && selectionStart <= prefixLength && selectionEnd <= prefixLength) {
            event.preventDefault();
            messageInput.selectionStart = messageInput.selectionEnd = prefixLength;
            return;
          }

          if (event.key === "Delete" && selectionStart >= editableEnd) {
            event.preventDefault();
            messageInput.selectionStart = messageInput.selectionEnd = editableEnd;
            return;
          }

          if (event.key === "Home") {
            event.preventDefault();
            messageInput.selectionStart = messageInput.selectionEnd = prefixLength;
            return;
          }
        }

        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          chatForm.requestSubmit();
        }
      });

      messageInput.addEventListener("input", () => {
        if (activeTemplateState) {
          syncTemplateMessageInput(messageInput.selectionStart);
        }
      });

      messageInput.addEventListener("click", () => {
        if (activeTemplateState) {
          syncTemplateMessageInput(messageInput.selectionStart);
        }
      });

      chatMessages.addEventListener("click", (event) => {
        const replyButton = event.target.closest(".chat-reply-button");
        if (replyButton) {
          const playerName = replyButton.getAttribute("data-player") || "";
          window.replyToChatMessage(playerName);
          return;
        }

        const pinButton = event.target.closest(".chat-pin-button");
        if (pinButton) {
          const msgId = pinButton.getAttribute("data-msg-id") || "";
          togglePinMessage(msgId);
          return;
        }
      });

      // Pinned message banner handlers
      const chatPinnedBanner = document.getElementById("chatPinnedBanner");
      if (chatPinnedBanner) {
        chatPinnedBanner.addEventListener("click", (event) => {
          const unpinBtn = event.target.closest("#chatPinnedUnpinBtn");
          const pinnedMsgId = chatPinnedBanner.dataset.pinnedMsgId;
          if (!pinnedMsgId) return;

          if (unpinBtn) {
            event.stopPropagation();
            togglePinMessage(pinnedMsgId);
          } else {
            // Scroll to pinned message
            const msgEl = chatMessages.querySelector('[data-msg-id="' + pinnedMsgId + '"]');
            if (msgEl) {
              msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              msgEl.style.transition = "background-color 0.5s ease";
              const originalBg = msgEl.style.backgroundColor;
              msgEl.style.backgroundColor = 'rgba(90, 169, 255, 0.3)';
              setTimeout(() => {
                msgEl.style.backgroundColor = originalBg;
              }, 2000);
            }
          }
        });
      }

      async function togglePinMessage(msgId) {
        if (!currentRoom || !myClientId) return;
        try {
          const res = await fetch("/api/chat/pin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ room: getChatRoomKey(currentRoom), clientId: myClientId, messageId: msgId })
          });
          const data = await res.json();
          if (res.ok && data.ok) {
            loadStateAndChat();
          } else {
            alert(data.error || "Failed to pin/unpin message.");
          }
        } catch(e) {
          alert("Error: " + e.message);
        }
      }

      let isNotesPanelExpanded = false;
      let activeNotesTab = null; // 'targets' or 'notes'

      window.toggleHeaderTab = function(tab) {
        const notesPanel = document.getElementById('notesPanel');
        const tabTargetsView = document.getElementById('tabTargetsView');
        const tabNotesView = document.getElementById('tabNotesView');
        const hTBtn = document.getElementById('headerTargetsBtn');
        const hNBtn = document.getElementById('headerNotesBtn');
        if (!notesPanel || !tabTargetsView || !tabNotesView) return;

        if (activeNotesTab === tab) {
          // Same button clicked again — toggle close
          notesPanel.style.display = 'none';
          activeNotesTab = null;
          if (hTBtn) { hTBtn.style.borderColor = 'var(--border)'; hTBtn.style.color = 'var(--muted)'; }
          if (hNBtn) { hNBtn.style.borderColor = 'var(--border)'; hNBtn.style.color = 'var(--muted)'; }
        } else {
          // Switch to this tab and open panel
          activeNotesTab = tab;
          notesPanel.style.display = 'block';
          if (tab === 'targets') {
            tabTargetsView.style.display = 'block';
            tabNotesView.style.display = 'none';
            if (hTBtn) { hTBtn.style.borderColor = 'var(--accent)'; hTBtn.style.color = 'var(--accent)'; }
            if (hNBtn) { hNBtn.style.borderColor = 'var(--border)'; hNBtn.style.color = 'var(--muted)'; }
          } else {
            tabTargetsView.style.display = 'none';
            tabNotesView.style.display = 'block';
            if (hNBtn) { hNBtn.style.borderColor = 'var(--accent)'; hNBtn.style.color = 'var(--accent)'; }
            if (hTBtn) { hTBtn.style.borderColor = 'var(--border)'; hTBtn.style.color = 'var(--muted)'; }
          }
        }
      };

      // Legacy toggleNotesPanelBody kept for safety (no-op)
      window.toggleNotesPanelBody = function() {};


      window.toggleTargetDead = async function(targetId) {
        if (!currentRoom || !myClientId) return;
        try {
          const res = await fetch('/api/rooms/targets/toggle-dead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room: currentRoom, clientId: myClientId, targetId, player: myPlayerName })
          });
          const data = await res.json();
          if (res.ok && data.ok) {
            loadStateAndChat();
          } else {
            alert(data.error || 'Failed to toggle target status.');
          }
        } catch(e) {
          alert(e.message);
        }
      };

      window.handleNewTarget = async function(event) {
        event.preventDefault();
        const input = document.getElementById("targetNameInput");
        const name = (input.value || "").trim();
        if (!name || !currentRoom || !myClientId) return;

        try {
          const res = await fetch("/api/rooms/targets/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ room: currentRoom, clientId: myClientId, player: myPlayerName, name })
          });
          const data = await res.json();
          if (res.ok && data.ok) {
            input.value = "";
            loadStateAndChat();
          } else {
            alert(data.error || "Failed to add target.");
          }
        } catch(e) {
          alert(e.message);
        }
      };

      window.deleteTarget = async function(targetId) {
        if (!confirm("Delete this target?")) return;
        try {
          const res = await fetch("/api/rooms/targets/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ room: currentRoom, clientId: myClientId, targetId })
          });
          const data = await res.json();
          if (res.ok && data.ok) {
            loadStateAndChat();
          } else {
            alert(data.error || "Failed to delete target.");
          }
        } catch(e) {
          alert(e.message);
        }
      };

      window.handleNewNote = async function(event) {
        event.preventDefault();
        const input = document.getElementById("noteTextInput");
        const text = (input.value || "").trim();
        if (!text || !currentRoom || !myClientId) return;

        try {
          const res = await fetch("/api/rooms/notes/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ room: currentRoom, clientId: myClientId, player: myPlayerName, text })
          });
          const data = await res.json();
          if (res.ok && data.ok) {
            input.value = "";
            loadStateAndChat();
          } else {
            alert(data.error || "Failed to add note.");
          }
        } catch(e) {
          alert(e.message);
        }
      };

      window.deleteNote = async function(noteId) {
        if (!confirm("Delete this note?")) return;
        try {
          const res = await fetch("/api/rooms/notes/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ room: currentRoom, clientId: myClientId, noteId })
          });
          const data = await res.json();
          if (res.ok && data.ok) {
            loadStateAndChat();
          } else {
            alert(data.error || "Failed to delete note.");
          }
        } catch(e) {
          alert(e.message);
        }
      };

      updateChatFormState();

      // Create/Join room bindings
      document.getElementById("createRoomBtn").addEventListener("click", async () => {
        const nameInput = document.getElementById("newRoomInput");
        const roomName = nameInput.value.trim();
        if (!roomName) return;
        if (!/^[A-Za-z0-9_-]{1,32}$/.test(roomName)) {
          alert("Invalid room name. 1-32 chars, letters, numbers, _ and - only.");
          return;
        }
        if (!myClientId || !myPlayerName) {
          alert("Connect first: player name not detected.");
          return;
        }
        try {
          const res = await fetch("/api/rooms/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ room: roomName, clientId: myClientId, player: myPlayerName })
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            alert(data.error || "Failed to create room.");
            return;
          }
          nameInput.value = "";
          if (!joinedRooms.includes(roomName)) {
            joinedRooms.push(roomName);
            try {
              localStorage.setItem("omerta_joined_rooms", JSON.stringify(joinedRooms));
            } catch(e){}
          }
          selectRoom(roomName);
        } catch (err) {
          alert("Error creating room: " + err.message);
        }
      });

      document.getElementById("joinRoomBtn").addEventListener("click", async () => {
        const nameInput = document.getElementById("newRoomInput");
        const roomName = nameInput.value.trim();
        if (!roomName) return;
        if (!/^[A-Za-z0-9_-]{1,32}$/.test(roomName)) {
          alert("Invalid room name. 1-32 chars, letters, numbers, _ and - only.");
          return;
        }
        if (!myClientId || !myPlayerName) {
          alert("Connect first: player name not detected.");
          return;
        }
        try {
          const res = await fetch("/api/rooms/request-join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ room: roomName, clientId: myClientId, player: myPlayerName })
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            alert(data.error || "Failed to join room.");
            return;
          }
          nameInput.value = "";
          if (!joinedRooms.includes(roomName)) {
            joinedRooms.push(roomName);
            try {
              localStorage.setItem("omerta_joined_rooms", JSON.stringify(joinedRooms));
            } catch(e){}
          }
          selectRoom(roomName);
        } catch (err) {
          alert("Error joining room: " + err.message);
        }
      });

      renderRoomTabs();
      applyRoom(activeRoom);
    </script>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidRoom(room) {
  return typeof room === "string" && /^[A-Za-z0-9_-]{1,32}$/.test(room);
}

function requireFamilyKey(req, res, next) {
  if (!familyKey) {
    next();
    return;
  }

  const headerKey = req.header("x-family-key");
  if (headerKey !== familyKey) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }

  next();
}

function getOrCreateRoom(roomName) {
  if (!rooms[roomName]) {
    rooms[roomName] = {
      ownerClientId: "",
      ownerPlayer: "",
      members: {},
      pending: {},
      players: {},
      chat: [],
      obay: null,
      notes: [],
      targets: [],
    };
  } else {
    rooms[roomName].players = rooms[roomName].players || {};
    rooms[roomName].chat = rooms[roomName].chat || [];
    rooms[roomName].obay = rooms[roomName].obay || null;
    rooms[roomName].members = rooms[roomName].members || {};
    rooms[roomName].pending = rooms[roomName].pending || {};
    rooms[roomName].notes = rooms[roomName].notes || [];
    rooms[roomName].targets = rooms[roomName].targets || [];
  }
  return rooms[roomName];
}

function getRoomAccess(roomName, clientId) {
  if (!isValidRoom(roomName)) return "none";
  if (roomName === "General" || roomName === "TestRoom") return "member";

  const room = rooms[roomName];
  if (!room) return "none";
  if (!room.ownerClientId) return "member"; // If room has no owner, it is public
  if (room.ownerClientId === clientId) return "owner";

  if (room.members && room.members[clientId]) {
    return room.members[clientId].role || "member";
  }

  if (isRoomOwnerInactive(room)) {
    return "none";
  }

  if (room.pending && room.pending[clientId]) {
    return "pending";
  }

  return "none";
}

function normalizePlayerName(value) {
  return String(value || "").trim().toLowerCase();
}

function isSamePlayerName(a, b) {
  return normalizePlayerName(a) !== "" && normalizePlayerName(a) === normalizePlayerName(b);
}

function reclaimRoomOwnership(roomData, clientId, player) {
  const joinedAt = getServerTime();
  const oldOwnerClientId = roomData.ownerClientId || "";

  if (oldOwnerClientId && oldOwnerClientId !== clientId && roomData.members[oldOwnerClientId] && isSamePlayerName(roomData.members[oldOwnerClientId].player, player)) {
    delete roomData.members[oldOwnerClientId];
  }

  Object.keys(roomData.pending || {}).forEach((pendingClientId) => {
    const pendingEntry = roomData.pending[pendingClientId];
    if (pendingClientId === clientId || isSamePlayerName(pendingEntry && pendingEntry.player, player)) {
      delete roomData.pending[pendingClientId];
    }
  });

  roomData.ownerClientId = clientId;
  roomData.ownerPlayer = String(player || "").trim();
  roomData.members[clientId] = {
    player: String(player || "").trim(),
    role: "owner",
    joinedAt
  };
}

function isRoomOwnerInactive(roomData) {
  if (!roomData || !roomData.ownerClientId) {
    return true;
  }

  const ownerEntry = roomData.players && roomData.players[roomData.ownerClientId];
  if (!ownerEntry) {
    return true;
  }

  const updatedAt = Number(ownerEntry.updatedAt);
  if (!Number.isFinite(updatedAt)) {
    return true;
  }

  return getServerTime() - updatedAt > 90;
}

app.get("/", (_req, res) => {
  res.status(200).send(renderDashboardHtml());
});

app.post("/api/update", requireFamilyKey, (req, res) => {
  const { room, player, game, updatedAt, progression, cooldowns, clientId, serverId, serverName, hostname } = req.body || {};

  if (!isValidRoom(room)) {
    res.status(400).json({ ok: false, error: "Invalid room" });
    return;
  }

  if (typeof player !== "string" || !player.trim()) {
    res.status(400).json({ ok: false, error: "Player is required" });
    return;
  }

  if (!isPlainObject(cooldowns)) {
    res.status(400).json({ ok: false, error: "Cooldowns must be an object" });
    return;
  }

  const access = getRoomAccess(room, clientId);
  if (room !== "General" && room !== "TestRoom" && rooms[room] && rooms[room].ownerClientId && access !== "owner" && access !== "member") {
    res.status(403).json({ ok: false, error: "Access denied" });
    return;
  }

  const roomData = getOrCreateRoom(room);
  const targetServerId = (serverId || "nl").toLowerCase();
  const playerKey = targetServerId + ":" + player.trim();

  roomData.players[playerKey] = {
    clientId: clientId || "",
    player: player.trim(),
    serverId: targetServerId,
    serverName: serverName || "nl",
    hostname: hostname || "barafranca.nl",
    game: typeof game === "string" ? game : "",
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : getServerTime(),
    progression: isPlainObject(progression)
      ? {
        rank: typeof progression.rank === "string" ? progression.rank.trim() : "",
        progressionPercent: typeof progression.progressionPercent === "string" ? progression.progressionPercent.trim() : "",
        activityPercent: typeof progression.activityPercent === "string" ? progression.activityPercent.trim() : "",
        bullets: typeof progression.bullets === "string" ? progression.bullets.trim() : "",
        money: typeof progression.money === "string" ? progression.money.trim() : "",
        bank: typeof progression.bank === "string" ? progression.bank.trim() : "",
        platingLabel: typeof progression.platingLabel === "string" ? progression.platingLabel.trim() : "",
        platingPercent: typeof progression.platingPercent === "string" ? progression.platingPercent.trim() : "",
      }
      : {},
    cooldowns,
  };

  res.json({ ok: true });
});

app.get("/api/state", (req, res) => {
  const { room, clientId } = req.query;

  if (!isValidRoom(room)) {
    res.status(400).json({ ok: false, error: "Invalid room" });
    return;
  }

  const access = getRoomAccess(room, clientId);
  if (room !== "General" && room !== "TestRoom" && rooms[room] && rooms[room].ownerClientId && access !== "owner" && access !== "member") {
    res.status(403).json({ ok: false, error: "Access denied" });
    return;
  }

  const serverTime = getServerTime();
  const roomData = rooms[room] || { players: {} };
  pruneTransientTestPlayers(roomData, serverTime);
  const players = Object.values(roomData.players || {}).map((entry) => {
    let progression = entry.progression || {};
    let cooldowns = applyLockedCooldowns(entry.cooldowns || {}, progression.rank);

    if (room.toLowerCase() === "general") {
      progression = {
        rank: progression.rank,
        platingLabel: progression.platingLabel,
        progressionPercent: "***",
        activityPercent: "***",
        platingPercent: "***",
        bullets: "***",
        money: "***",
        bank: "***",
      };

      const censoredCooldowns = {};
      const allowedKeys = ["heist", "organizedCrime", "megaOrganizedCrime", "spot"];
      for (const [k, v] of Object.entries(cooldowns)) {
        if (allowedKeys.includes(k)) {
          censoredCooldowns[k] = applyLockedCooldowns({ [k]: v }, progression.rank)[k];
        } else {
          censoredCooldowns[k] = {
            label: v.label,
            timeEnd: 0,
            ready: false,
            censored: true
          };
        }
      }
      cooldowns = censoredCooldowns;
    }

    return {
      clientId: entry.clientId || "",
      player: entry.player,
      serverId: entry.serverId || "nl",
      serverName: entry.serverName || "nl",
      hostname: entry.hostname || "barafranca.nl",
      game: entry.game,
      updatedAt: entry.updatedAt,
      offline: serverTime - entry.updatedAt > 90,
      progression,
      cooldowns,
    };
  });

  res.json({
    room,
    serverTime,
    players,
    notes: roomData.notes || [],
    targets: roomData.targets || [],
  });
});

app.post("/api/obay/update", requireFamilyKey, (req, res) => {
  const { room, player, updatedAt, items, clientId, serverId } = req.body || {};

  if (!isValidRoom(room)) {
    res.status(400).json({ ok: false, error: "Invalid room" });
    return;
  }

  if (typeof player !== "string" || !player.trim()) {
    res.status(400).json({ ok: false, error: "Player is required" });
    return;
  }

  if (!Array.isArray(items)) {
    res.status(400).json({ ok: false, error: "Items must be an array" });
    return;
  }

  const access = getRoomAccess(room, clientId);
  if (room !== "General" && room !== "TestRoom" && rooms[room] && rooms[room].ownerClientId && access !== "owner" && access !== "member") {
    res.status(403).json({ ok: false, error: "Access denied" });
    return;
  }

  const roomData = getOrCreateRoom(room);
  roomData.obay = roomData.obay || {};
  const targetServerId = (serverId || "nl").toLowerCase();
  roomData.obay[targetServerId] = {
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : getServerTime(),
    updatedBy: player.trim(),
    items: items.map((item) => ({
      name: typeof item.name === "string" ? item.name.trim() : "",
      seller: typeof item.seller === "string" ? item.seller.trim() : "",
      minimumBid: typeof item.minimumBid === "string" ? item.minimumBid.trim() : "",
      bidder: typeof item.bidder === "string" ? item.bidder.trim() : "",
      endTime: typeof item.endTime === "string" ? item.endTime.trim() : "",
    })),
  };

  res.json({ ok: true });
});

app.get("/api/obay", (req, res) => {
  const { room, clientId, serverId } = req.query;

  if (!isValidRoom(room)) {
    res.status(400).json({ ok: false, error: "Invalid room" });
    return;
  }

  const access = getRoomAccess(room, clientId);
  if (room !== "General" && room !== "TestRoom" && rooms[room] && rooms[room].ownerClientId && access !== "owner" && access !== "member") {
    res.status(403).json({ ok: false, error: "Access denied" });
    return;
  }

  const targetServerId = (serverId || "nl").toLowerCase();
  const roomData = rooms[room] || {};
  const obayStore = roomData.obay || {};
  const obay = obayStore[targetServerId] || {
    updatedAt: 0,
    updatedBy: "",
    items: [],
  };

  res.json({
    room,
    serverId: targetServerId,
    updatedAt: obay.updatedAt,
    updatedBy: obay.updatedBy,
    items: obay.items,
  });
});

app.post("/api/chat", (req, res) => {
  const { room, player, message, clientId } = req.body || {};

  if (!isValidRoom(room)) {
    res.status(400).json({ ok: false, error: "Invalid room" });
    return;
  }

  if (typeof player !== "string" || !player.trim()) {
    res.status(400).json({ ok: false, error: "Player is required" });
    return;
  }

  let cleanMessage = typeof message === "string" ? message.trim() : "";
  cleanMessage = cleanMessage.replace(/\s*\(\)/g, "").trim();

  if (!cleanMessage) {
    res.status(400).json({ ok: false, error: "Message is required" });
    return;
  }

  if (cleanMessage.length > 300) {
    res.status(400).json({ ok: false, error: "Message is too long" });
    return;
  }

  const access = getRoomAccess(room, clientId);
  if (room !== "General" && room !== "TestRoom" && rooms[room] && rooms[room].ownerClientId && access !== "owner" && access !== "member") {
    res.status(403).json({ ok: false, error: "Access denied" });
    return;
  }

  const roomData = getOrCreateRoom(room);
  const messageId = "msg_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now();
  roomData.chat.push({
    id: messageId,
    player: player.trim(),
    message: escapeHtml(cleanMessage),
    createdAt: getServerTime(),
    pinned: false,
  });

  if (roomData.chat.length > 100) {
    roomData.chat = roomData.chat.slice(-100);
  }

  res.json({ ok: true });
});

app.get("/api/chat", (req, res) => {
  const { room, clientId } = req.query;

  if (!isValidRoom(room)) {
    res.status(400).json({ ok: false, error: "Invalid room" });
    return;
  }

  const access = getRoomAccess(room, clientId);
  if (room !== "General" && room !== "TestRoom" && rooms[room] && rooms[room].ownerClientId && access !== "owner" && access !== "member") {
    res.status(403).json({ ok: false, error: "Access denied" });
    return;
  }

  const roomData = rooms[room] || { chat: [] };
  res.json({
    room,
    messages: roomData.chat || [],
  });
});

app.post("/api/chat/pin", (req, res) => {
  const { room, messageId, clientId } = req.body || {};

  if (!isValidRoom(room)) {
    res.status(400).json({ ok: false, error: "Invalid room" });
    return;
  }

  const access = getRoomAccess(room, clientId);
  if (room !== "General" && room !== "TestRoom" && rooms[room] && rooms[room].ownerClientId && access !== "owner" && access !== "member") {
    res.status(403).json({ ok: false, error: "Access denied" });
    return;
  }

  const roomData = getOrCreateRoom(room);
  const message = (roomData.chat || []).find((m) => m.id === messageId);
  if (!message) {
    res.status(404).json({ ok: false, error: "Message not found" });
    return;
  }

  message.pinned = !message.pinned;
  res.json({ ok: true, pinned: message.pinned });
});

app.post("/api/rooms/notes/add", (req, res) => {
  const { room, clientId, player, text } = req.body || {};

  if (!isValidRoom(room)) {
    res.status(400).json({ ok: false, error: "Invalid room" });
    return;
  }

  if (typeof text !== "string" || !text.trim()) {
    res.status(400).json({ ok: false, error: "Text is required" });
    return;
  }

  const access = getRoomAccess(room, clientId);
  if (room !== "General" && room !== "TestRoom" && rooms[room] && rooms[room].ownerClientId && access !== "owner" && access !== "member") {
    res.status(403).json({ ok: false, error: "Access denied" });
    return;
  }

  const roomData = getOrCreateRoom(room);
  roomData.notes = roomData.notes || [];
  const noteId = "note_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now();
  roomData.notes.push({
    id: noteId,
    text: text.trim(),
    addedBy: (player || "Unknown").trim(),
    createdAt: getServerTime(),
  });

  saveRoomsStore(rooms);
  res.json({ ok: true });
});

app.post("/api/rooms/notes/delete", (req, res) => {
  const { room, clientId, noteId } = req.body || {};

  if (!isValidRoom(room)) {
    res.status(400).json({ ok: false, error: "Invalid room" });
    return;
  }

  const access = getRoomAccess(room, clientId);
  if (room !== "General" && room !== "TestRoom" && rooms[room] && rooms[room].ownerClientId && access !== "owner" && access !== "member") {
    res.status(403).json({ ok: false, error: "Access denied" });
    return;
  }

  const roomData = getOrCreateRoom(room);
  roomData.notes = roomData.notes || [];
  const originalLength = roomData.notes.length;
  roomData.notes = roomData.notes.filter((n) => n.id !== noteId);

  if (roomData.notes.length < originalLength) {
    saveRoomsStore(rooms);
    res.json({ ok: true });
  } else {
    res.status(404).json({ ok: false, error: "Note not found" });
  }
});

app.post("/api/rooms/targets/add", (req, res) => {
  const { room, clientId, player, name } = req.body || {};

  if (!isValidRoom(room)) {
    res.status(400).json({ ok: false, error: "Invalid room" });
    return;
  }

  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ ok: false, error: "Target name is required" });
    return;
  }

  const access = getRoomAccess(room, clientId);
  if (room !== "General" && room !== "TestRoom" && rooms[room] && rooms[room].ownerClientId && access !== "owner" && access !== "member") {
    res.status(403).json({ ok: false, error: "Access denied" });
    return;
  }

  const roomData = getOrCreateRoom(room);
  roomData.targets = roomData.targets || [];
  const targetId = 'target_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
  roomData.targets.push({
    id: targetId,
    name: name.trim(),
    addedBy: (player || 'Unknown').trim(),
    createdAt: getServerTime(),
    dead: false,
  });

  saveRoomsStore(rooms);
  res.json({ ok: true });
});

app.post('/api/rooms/targets/toggle-dead', (req, res) => {
  const { room, clientId, targetId, player } = req.body || {};

  if (!isValidRoom(room)) {
    res.status(400).json({ ok: false, error: 'Invalid room' });
    return;
  }

  const access = getRoomAccess(room, clientId);
  if (room !== 'General' && room !== 'TestRoom' && rooms[room] && rooms[room].ownerClientId && access !== 'owner' && access !== 'member') {
    res.status(403).json({ ok: false, error: 'Access denied' });
    return;
  }

  const roomData = getOrCreateRoom(room);
  roomData.targets = roomData.targets || [];
  const target = roomData.targets.find((t) => t.id === targetId);
  if (!target) {
    res.status(404).json({ ok: false, error: 'Target not found' });
    return;
  }

  target.dead = !target.dead;
  saveRoomsStore(rooms);

  // Post a system notification to the room chat
  const actorName = (player || 'Someone').trim();
  const systemMsgId = 'sys_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
  const systemText = target.dead
    ? '\u2620\ufe0f ' + actorName + ' marked \u201c' + target.name + '\u201d as DEAD.'
    : '\u2705 ' + actorName + ' marked \u201c' + target.name + '\u201d as ALIVE.';
  roomData.chat = roomData.chat || [];
  roomData.chat.push({
    id: systemMsgId,
    player: '\u2699\ufe0f System',
    message: systemText,
    createdAt: getServerTime(),
    pinned: false,
    system: true,
  });
  if (roomData.chat.length > 100) {
    roomData.chat = roomData.chat.slice(-100);
  }

  res.json({ ok: true, dead: target.dead });
});


app.post("/api/rooms/targets/delete", (req, res) => {
  const { room, clientId, targetId } = req.body || {};

  if (!isValidRoom(room)) {
    res.status(400).json({ ok: false, error: "Invalid room" });
    return;
  }

  const access = getRoomAccess(room, clientId);
  if (room !== "General" && room !== "TestRoom" && rooms[room] && rooms[room].ownerClientId && access !== "owner" && access !== "member") {
    res.status(403).json({ ok: false, error: "Access denied" });
    return;
  }

  const roomData = getOrCreateRoom(room);
  roomData.targets = roomData.targets || [];
  const originalLength = roomData.targets.length;
  roomData.targets = roomData.targets.filter((t) => t.id !== targetId);

  if (roomData.targets.length < originalLength) {
    saveRoomsStore(rooms);
    res.json({ ok: true });
  } else {
    res.status(404).json({ ok: false, error: "Target not found" });
  }
});

app.post("/api/rooms/create", (req, res) => {
  const { room, clientId, player } = req.body || {};
  if (!isValidRoom(room)) {
    return res.status(400).json({ ok: false, error: "Invalid room name" });
  }
  if (!clientId || !player) {
    return res.status(400).json({ ok: false, error: "ClientId and Player are required" });
  }

  const roomData = getOrCreateRoom(room);
  if (roomData.ownerClientId && roomData.ownerClientId !== clientId) {
    if (isSamePlayerName(roomData.ownerPlayer, player) || isRoomOwnerInactive(roomData)) {
      reclaimRoomOwnership(roomData, clientId, player);
      saveRoomsStore(rooms);
      return res.json({ ok: true, role: "owner" });
    }
    return res.status(400).json({ ok: false, error: "Room already exists and is owned by someone else" });
  }

  reclaimRoomOwnership(roomData, clientId, player);
  saveRoomsStore(rooms);

  res.json({ ok: true, role: "owner" });
});

app.post("/api/rooms/request-join", (req, res) => {
  const { room, clientId, player } = req.body || {};
  if (!isValidRoom(room)) {
    return res.status(400).json({ ok: false, error: "Invalid room name" });
  }
  if (!clientId || !player) {
    return res.status(400).json({ ok: false, error: "ClientId and Player are required" });
  }

  const roomData = getOrCreateRoom(room);
  if (!roomData.ownerClientId) {
    reclaimRoomOwnership(roomData, clientId, player);
    saveRoomsStore(rooms);
    return res.json({ ok: true, role: "owner" });
  }

  if (isSamePlayerName(roomData.ownerPlayer, player) || isRoomOwnerInactive(roomData)) {
    reclaimRoomOwnership(roomData, clientId, player);
    saveRoomsStore(rooms);
    return res.json({ ok: true, role: "owner" });
  }

  if (roomData.members[clientId]) {
    return res.json({ ok: true, role: roomData.members[clientId].role || "member" });
  }

  if (roomData.pending[clientId]) {
    return res.json({ ok: true, role: "pending" });
  }

  roomData.pending[clientId] = {
    player: player.trim(),
    requestedAt: getServerTime()
  };
  saveRoomsStore(rooms);

  res.json({ ok: true, role: "pending" });
});

app.get("/api/rooms/status", (req, res) => {
  const { room, clientId } = req.query;
  const status = getRoomAccess(room, clientId);
  res.json({ ok: true, status });
});

app.get("/api/rooms/pending", (req, res) => {
  const { room, clientId } = req.query;
  if (!isValidRoom(room)) {
    return res.status(400).json({ ok: false, error: "Invalid room name" });
  }
  const roomData = rooms[room];
  if (!roomData || roomData.ownerClientId !== clientId) {
    return res.status(403).json({ ok: false, error: "Access denied" });
  }

  const list = Object.entries(roomData.pending || {}).map(([id, data]) => ({
    clientId: id,
    player: data.player,
    requestedAt: data.requestedAt
  }));
  res.json({ ok: true, pending: list });
});

app.get("/api/rooms/members", (req, res) => {
  const { room, clientId } = req.query;
  if (!isValidRoom(room)) {
    return res.status(400).json({ ok: false, error: "Invalid room name" });
  }
  const roomData = rooms[room];
  if (!roomData || roomData.ownerClientId !== clientId) {
    return res.status(403).json({ ok: false, error: "Access denied" });
  }

  const list = Object.entries(roomData.members || {}).map(([id, data]) => ({
    clientId: id,
    player: data.player,
    role: data.role,
    joinedAt: data.joinedAt
  }));
  res.json({ ok: true, members: list });
});

app.post("/api/rooms/approve", (req, res) => {
  const { room, clientId, targetClientId } = req.body || {};
  if (!isValidRoom(room)) {
    return res.status(400).json({ ok: false, error: "Invalid room name" });
  }
  const roomData = rooms[room];
  if (!roomData || roomData.ownerClientId !== clientId) {
    return res.status(403).json({ ok: false, error: "Access denied" });
  }

  const pendingUser = roomData.pending[targetClientId];
  if (!pendingUser) {
    return res.status(400).json({ ok: false, error: "Target player not pending" });
  }

  roomData.members[targetClientId] = {
    player: pendingUser.player,
    role: "member",
    joinedAt: getServerTime()
  };
  delete roomData.pending[targetClientId];
  saveRoomsStore(rooms);

  res.json({ ok: true });
});

app.post("/api/rooms/reject", (req, res) => {
  const { room, clientId, targetClientId } = req.body || {};
  if (!isValidRoom(room)) {
    return res.status(400).json({ ok: false, error: "Invalid room name" });
  }
  const roomData = rooms[room];
  if (!roomData || roomData.ownerClientId !== clientId) {
    return res.status(403).json({ ok: false, error: "Access denied" });
  }

  if (roomData.pending[targetClientId]) {
    delete roomData.pending[targetClientId];
    saveRoomsStore(rooms);
    return res.json({ ok: true });
  }

  res.status(400).json({ ok: false, error: "Target player not pending" });
});

app.post("/api/rooms/kick", (req, res) => {
  const { room, clientId, targetClientId } = req.body || {};
  if (!isValidRoom(room)) {
    return res.status(400).json({ ok: false, error: "Invalid room name" });
  }
  const roomData = rooms[room];
  if (!roomData || roomData.ownerClientId !== clientId) {
    return res.status(403).json({ ok: false, error: "Access denied" });
  }
  if (clientId === targetClientId) {
    return res.status(400).json({ ok: false, error: "Cannot kick yourself" });
  }

  if (roomData.members[targetClientId]) {
    delete roomData.members[targetClientId];
    saveRoomsStore(rooms);
    return res.json({ ok: true });
  }

  res.status(400).json({ ok: false, error: "Target player not member" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Omerta Portal server running on http://localhost:${port}`);
});
