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
const obayFilePath = path.join(__dirname, "data", "obay.json");

// Global Obay store: { [serverId]: { updatedAt, updatedBy, items } }
function loadObayStore() {
  try {
    if (fs.existsSync(obayFilePath)) {
      return JSON.parse(fs.readFileSync(obayFilePath, "utf8")) || {};
    }
  } catch (e) {}
  return {};
}
function saveObayStore() {
  try {
    fs.mkdirSync(path.dirname(obayFilePath), { recursive: true });
    fs.writeFileSync(obayFilePath, JSON.stringify(obayData, null, 2), "utf8");
  } catch (e) {}
}
const obayData = loadObayStore();

function loadRoomsStore() {
  try {
    if (fs.existsSync(roomsFilePath)) {
      const content = fs.readFileSync(roomsFilePath, "utf8");
      const data = JSON.parse(content);
      for (const room of Object.values(data)) {
        room.players = room.players || {};
        room.chat = room.chat || [];
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
    notes: [],
    targets: []
  };
  modified = true;
}
if (modified) {
  saveRoomsStore(rooms);
}

const gameChatStore = {};
const gameChatOutbox = [];
let gameChatOutboxCounter = 0;

app.use(cors());
app.use(express.json());
app.use("/icons", express.static(path.join(__dirname, "../icons")));

app.get("/privacy", (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Privacy Policy</title>
    </head>
    <body>
      <h1>Privacy Policy</h1>

      <p>Omerta Portal collects only the information required to provide its features, including dashboard synchronization and room chat functionality.</p>

      <p>Room chat messages and supported game page content are processed solely to provide the extension's intended features.</p>

      <p>No user data is sold or shared with third parties for advertising or marketing purposes.</p>

      <p>Data is used exclusively for the operation of Omerta Portal.</p>

      <p>Contact: srhtshr@gmail.com</p>
    </body>
    </html>
  `);
});

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
    <title>Omerta Portal v2.0</title>
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

      .brand-row {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-right: auto;
      }

      .brand {
        font-size: 22px;
        font-weight: 700;
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

      .lang-switcher {
        display: flex;
        align-items: center;
        gap: 4px;
        background: rgba(255,255,255,0.04);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 3px 4px;
      }
      .lang-btn {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        padding: 4px 8px;
        min-width: 38px;
        border-radius: 7px;
        border: none;
        background: transparent;
        color: var(--muted);
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.15s ease;
        letter-spacing: 0.3px;
      }
      .lang-btn:hover { background: rgba(255,255,255,0.07); color: var(--text); }
      .lang-btn.active { background: var(--accent); color: #fff; }
      .lang-btn .lang-label { font-size: 10px; line-height: 1; }
      .lang-btn .flag-icon { width: 24px; height: 16px; border-radius: 2px; display: block; }

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
        justify-content: flex-start;
        gap: 8px;
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
        flex-shrink: 0;
      }

      .nickname-player {
        color: var(--yellow);
        font-size: 12px;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
        text-align: center;
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
        padding: 6px 12px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        user-select: none;
        height: 32px;
        box-sizing: border-box;
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
        border-radius: 8px;
        background-color: rgba(23, 29, 39, 0.95);
        color: var(--text);
        padding: 0 8px;
        font-size: 11px;
        width: 120px;
        outline: none;
        transition: border-color 0.15s ease;
        cursor: pointer;
        height: 32px;
        box-sizing: border-box;
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
        border-radius: 8px;
        background-color: rgba(23, 29, 39, 0.95);
        color: var(--text);
        padding: 0 12px;
        font-size: 11px;
        font-weight: 700;
        min-width: 100px;
        outline: none;
        transition: all 0.15s ease;
        cursor: pointer;
        height: 32px;
        box-sizing: border-box;
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

      .cooldowns-panel-header {
        align-items: stretch;
        gap: 12px;
      }

      .cooldowns-header-main,
      .cooldowns-header-links {
        display: flex;
        align-items: center;
        min-width: 0;
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 10px;
        background: rgba(10, 14, 24, 0.72);
      }

      .cooldowns-header-main {
        flex: 1 1 auto;
        padding: 8px 10px;
      }

      .cooldowns-header-links {
        flex: 0 0 auto;
        padding: 8px 12px;
      }

      .cooldowns-header-main-inner {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        min-width: 0;
        width: 100%;
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

      .game-clock-display {
        font-family: 'Courier New', Courier, monospace;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 3px;
        color: #a8c8e8;
        background: rgba(0,0,0,0.28);
        padding: 3px 10px;
        border-radius: 5px;
        border: 1px solid rgba(168,200,232,0.15);
        min-width: 110px;
        text-align: center;
        flex-shrink: 0;
      }

      .table-wrap {
        overflow: hidden;
        padding: 0 0 4px;
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

      th:not(:last-child),
      td:not(:last-child) {
        border-right: 1px solid rgba(255, 255, 255, 0.05);
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

      .progress-cell {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 18px;
      }

      .progress-bar {
        position: relative;
        flex: 0 0 42px;
        width: 42px;
        height: 10px;
        border-radius: 999px;
        background: rgba(84, 101, 138, 0.28);
        overflow: hidden;
      }

      .progress-bar-fill {
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, #4e72ff 0%, #5b7cff 100%);
        box-shadow: 0 0 8px rgba(91, 124, 255, 0.28);
      }

      .progress-value {
        color: var(--accent);
        font-weight: 700;
        font-size: 11px;
        min-width: 34px;
        text-align: right;
      }

      .player-offline {
        color: var(--gray);
      }

      .ready {
        color: var(--green);
        font-weight: 700;
      }

      .ready-dot {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #2ecc71;
        vertical-align: middle;
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
        align-items: baseline;
        flex-wrap: wrap;
        gap: 3px;
        font-size: 11px;
        line-height: 1.5;
        padding: 1px 0;
        word-break: break-word;
        max-width: 100%;
        background: transparent;
        border: none;
        border-radius: 0;
        box-shadow: none;
      }

      .chat-item.own { }
      .chat-item.own:hover { background: transparent; }
      .chat-item.other { }

      .chat-content { word-break: break-word; }

      .chat-actions { display: inline-flex; align-items: center; }

      .chat-meta-row { display: none; }

      .chat-reply-button {
        border: 0;
        background: transparent;
        color: var(--muted);
        font-size: 10px;
        cursor: pointer;
        padding: 0 2px;
        opacity: 0.6;
      }

      .chat-reply-button:hover {
        color: var(--accent);
        opacity: 1;
      }

      .chat-player {
        font-weight: 700;
        text-decoration: none;
        cursor: pointer;
        flex-shrink: 0;
      }

      .chat-player:hover {
        text-decoration: underline;
        opacity: 0.85;
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
        border-left: 2px solid rgba(255, 214, 102, 0.35);
        padding-left: 5px;
      }

      .chat-item.template-message.own { background: transparent; }
      .chat-item.template-message.other { background: transparent; }

      .chat-item.template-message .chat-keyword {
        color: #7fd3ff !important;
        font-weight: 800;
      }

      .chat-item.template-message .chat-location {
        color: #ffffff !important;
        font-weight: 800;
      }

      .chat-time {
        color: #7f8794;
        font-size: 9px;
        white-space: nowrap;
        flex-shrink: 0;
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
        position: relative;
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

      .chat-shortcut.active-template {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }

      .shortcut-ready-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #2ecc71;
        border: 1.5px solid var(--panel);
        display: none;
        pointer-events: none;
      }

      .chat-shortcut.has-ready-badge .shortcut-ready-badge {
        display: block;
      }

      .shortcut-locked-icon {
        position: absolute;
        top: -6px;
        right: -6px;
        width: 14px;
        height: 14px;
        border-radius: 999px;
        display: none;
        align-items: center;
        justify-content: center;
        font-size: 9px;
        line-height: 1;
        pointer-events: none;
      }

      .chat-shortcut.has-locked-badge .shortcut-locked-icon {
        display: inline-flex;
      }

      .chat-row {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
      }

      .chat-form .chat-row:last-child {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
      }

      .chat-form .chat-row:last-child .feedback {
        margin-right: auto;
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

      .layout {
        display: block;
      }

      .portal-workspace {
        display: grid;
        grid-template-columns: minmax(0, 2.05fr) minmax(360px, 1fr);
        gap: 14px;
        align-items: stretch;
        margin-top: 12px;
        margin-bottom: 14px;
      }

      .game-chats-panel,
      .private-chat-panel {
        min-height: 0;
      }

      .game-chats-panel {
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .portal-chat-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .portal-chat-meta {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        color: var(--muted);
        font-size: 12px;
      }

      .dual-chat-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        padding: 0 12px 12px;
      }

      .game-chat-card {
        display: flex;
        flex-direction: column;
        min-height: 0;
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 14px;
        background: linear-gradient(180deg, rgba(11, 18, 29, 0.92) 0%, rgba(17, 24, 36, 0.92) 100%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
        overflow: hidden;
      }

      .game-chat-card.general .chat-column-title {
        color: var(--accent);
      }

      .game-chat-card.crimes .chat-column-title {
        color: #ff5d5d;
      }

      .chat-column-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 12px 14px 10px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }

      .chat-column-title {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 15px;
        font-weight: 800;
        letter-spacing: 0.02em;
      }

      .chat-column-caption {
        color: var(--muted);
        font-size: 11px;
        font-weight: 700;
      }

      .private-chat-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 14px 10px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        background: linear-gradient(180deg, rgba(15, 20, 31, 0.96) 0%, rgba(13, 18, 28, 0.96) 100%);
      }

      .private-tabs-strip {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        width: 100%;
      }

      .private-chat-header .room-tab {
        padding: 8px 14px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255,255,255,0.08);
        color: var(--muted);
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.02em;
      }

      .private-chat-header .room-tab.active {
        color: #7db6ff;
        border-color: #7db6ff;
        background: rgba(125, 182, 255, 0.08);
        box-shadow: 0 0 0 1px rgba(125, 182, 255, 0.08), 0 6px 16px rgba(0, 0, 0, 0.18);
      }

      .private-chat-header .room-tab:hover:not(.active) {
        color: var(--text);
        border-color: rgba(255,255,255,0.16);
        background: rgba(255,255,255,0.05);
      }

      .chat-messages.compact {
        min-height: 350px;
        max-height: 350px;
        padding: 12px;
      }

      .chat-form.compact {
        padding: 8px 12px 10px;
        gap: 6px;
      }

      .chat-form.compact textarea.input {
        min-height: 38px;
        resize: none;
      }

      .chat-submit-row {
        display: flex;
        align-items: center;
        gap: 8px;
        justify-content: flex-end;
      }

      .chat-compose-row {
        display: flex;
        align-items: stretch;
        gap: 10px;
      }

      .chat-compose-row textarea.input {
        flex: 1;
      }

      .chat-submit-row .button[type="submit"] {
        min-width: 92px;
      }

      .chat-submit-row .feedback {
        flex: 1;
        min-width: 0;
      }

      .chat-connection-indicator {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 20px;
        padding: 0 8px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.03);
      }

      .chat-connection-dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        display: inline-block;
      }

      .chat-connection-dot.online {
        background: #33d17a;
        box-shadow: 0 0 8px rgba(51, 209, 122, 0.55);
      }

      .chat-connection-dot.offline {
        background: #6f7b8f;
      }

      .chat-connection-dot.error {
        background: #ff6b6b;
        box-shadow: 0 0 8px rgba(255, 107, 107, 0.45);
      }

      .feedback.connection-only {
        display: inline-flex;
        align-items: center;
        min-height: 20px;
      }

      .chat-column-title .feedback.connection-only {
        min-height: auto;
      }

      .private-chat-panel {
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .private-panel-body {
        display: block;
        padding: 0 12px 12px;
        min-height: 0;
        flex: 1;
      }

      .private-room-sidebar,
      .room-tab-stack {
        display: none;
      }

      .private-room-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding-bottom: 10px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        margin-bottom: 10px;
        flex-wrap: wrap;
      }

      .private-room-select-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        min-width: 220px;
      }

      .private-room-select {
        flex: 1;
        min-width: 0;
        height: 38px;
        padding: 0 12px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: rgba(255,255,255,0.03);
        color: var(--text);
      }

      .private-room-actions {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }

      .private-room-action-row {
        display: flex;
        gap: 8px;
      }

      .private-chat-main {
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 14px;
        background: rgba(7, 12, 21, 0.52);
        overflow: hidden;
      }

      .private-chat-main #chatMessages {
        min-height: 350px;
        max-height: 350px;
      }

      .private-chat-main #chatForm {
        padding: 8px 12px 10px;
        gap: 6px;
      }

      .private-chat-main #chatForm textarea.input {
        min-height: 38px;
        resize: none;
      }

      .private-room-inline {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: -2px;
        margin-left: auto;
        flex: 0 0 auto;
        width: auto;
        min-width: fit-content;
        max-width: none;
        justify-content: flex-end;
        white-space: nowrap;
      }

      .private-room-inline-wrap {
        position: relative;
        flex: 0 0 150px;
        width: 150px;
        min-width: 150px;
        max-width: 150px;
      }

      .private-room-inline-wrap .input {
        width: 100%;
        min-width: 0;
        height: 32px;
        min-height: 32px;
        padding: 6px 42px 6px 10px;
        font-size: 11px;
      }

      .private-room-inline-wrap #createRoomBtn {
        position: absolute;
        top: 50%;
        right: 6px;
        transform: translateY(-50%);
        width: 24px !important;
        min-width: 24px !important;
        height: 24px;
        padding: 0 !important;
        border-radius: 8px;
        font-size: 16px !important;
        line-height: 1;
      }

      .private-room-inline #joinRoomBtn {
        height: 32px;
        padding: 0 12px;
        font-size: 11px;
        white-space: nowrap;
        flex: 0 0 auto;
      }

      .private-chat-controls-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: nowrap;
        gap: 10px;
        width: 100%;
      }

      .private-chat-controls-row .chat-shortcuts {
        flex: 1 1 auto;
        min-width: 0;
      }

      .city-shortcut-button {
        position: relative;
        min-width: 54px;
        justify-content: center;
      }

      .city-shortcut-button.has-alert {
        color: #ff6b6b;
        border-color: rgba(255, 107, 107, 0.35);
        background: rgba(255, 107, 107, 0.08);
        box-shadow: 0 0 0 1px rgba(255, 107, 107, 0.08);
      }

      .city-shortcut-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        width: 16px;
        height: 16px;
        border-radius: 999px;
        display: none;
        align-items: center;
        justify-content: center;
        background: #b42318;
        color: #fff;
        font-size: 10px;
        line-height: 1;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.28);
      }

      .city-shortcut-button.has-alert .city-shortcut-badge {
        display: inline-flex;
      }

      .mail-shortcut-button {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }

      .private-chat-stage {
        display: flex;
        flex-direction: column;
        min-height: 0;
        flex: 1;
        position: relative;
      }

      .private-chat-empty-state {
        display: none;
        align-items: center;
        justify-content: center;
        min-height: 220px;
        padding: 20px;
        text-align: center;
        color: var(--muted);
        font-size: 13px;
      }

      .private-chat-main.is-idle #chatPinnedContainer,
      .private-chat-main.is-idle #chatMessages,
      .private-chat-main.is-idle #chatForm,
      .private-chat-main.is-idle #notesPanel {
        display: none !important;
      }

      .private-chat-main.is-idle .private-chat-empty-state {
        display: flex;
      }

      .private-panel-topline {
        display: none;
      }

      .private-panel-topline .status-line {
        display: none;
      }

      #notesPanelHeaderButtons {
        justify-content: flex-end;
        align-items: center;
      }

      #notesPanelHeaderButtons .button {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }

      @media (max-width: 1100px) {
        .portal-workspace,
        .private-panel-body,
        .dual-chat-grid {
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
        <div class="brand-row">
          <div class="brand">Omerta Portal v2.0</div>
          <div class="lang-switcher">
            <button class="lang-btn active" id="langBtnTR" onclick="setLang('tr')"><span class="lang-label">TR</span><svg class="flag-icon" width="24" height="16" viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg"><rect width="30" height="20" fill="#E30A17"/><circle cx="11.5" cy="10" r="5.5" fill="white"/><circle cx="13.5" cy="10" r="4.3" fill="#E30A17"/><polygon fill="white" points="18.5,10 20,7.5 22.5,9 20.5,6.8 22.5,4.5 20,6 18.5,3.5 18.5,6.2 16,4.5 18,7 16,9.2 18.5,7.7"/></svg></button>
            <button class="lang-btn" id="langBtnEN" onclick="setLang('en')"><span class="lang-label">ENG</span><svg class="flag-icon" width="24" height="16" viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg"><rect width="30" height="20" fill="white"/><rect x="12.5" width="5" height="20" fill="#CF142B"/><rect y="7.5" width="30" height="5" fill="#CF142B"/></svg></button>
          </div>
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
        <div style="display:inline-flex;align-items:center;gap:3px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:12px;padding:3px 4px;margin-left:auto;">
          <button id="dashboardConnectBtn" class="button" type="button" style="display:inline-flex;align-items:center;justify-content:center;padding:6px 16px;border-radius:8px;border:none;background:var(--accent);color:#fff;font-weight:700;font-size:12px;cursor:pointer;transition:all 0.15s;white-space:nowrap;">↻ Synch</button>
          <a id="downloadExtensionLink" href="https://chromewebstore.google.com/detail/omerta-portal/flcbkcmfekjmipkoahgnnpijagflbpfc" target="_blank" rel="noopener noreferrer" data-i18n="downloadExtension" style="display:inline-flex;align-items:center;justify-content:center;padding:6px 16px;border-radius:8px;border:none;background:transparent;color:var(--muted);font-weight:700;font-size:12px;text-decoration:none;cursor:pointer;transition:all 0.15s;white-space:nowrap;">Download Extension</a>
        </div>
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
            <div class="panel-header cooldowns-panel-header">
              <div class="cooldowns-header-main">
                <div class="cooldowns-header-main-inner">
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
                <form id="playerProfileSearchForm" style="display:inline-flex;align-items:center;margin-left:14px;gap:4px;" onsubmit="handlePlayerProfileSearch(event)">
                  <input id="playerSearchInput" type="text" placeholder="Search player profile..." data-i18n-placeholder="searchPlayerProfile" style="border:1px solid var(--border);border-radius:8px;background:rgba(0,0,0,0.2);color:var(--text);padding:0 10px;font-size:11px;width:140px;outline:none;transition:border-color 0.15s ease;height:32px;box-sizing:border-box;" autocomplete="off" title="Enter character name and press Enter or Go">
                  <button type="submit" style="background:linear-gradient(180deg,#2b71c8 0%,#1f5ca8 100%);border:none;border-radius:8px;color:var(--text);padding:0 14px;font-size:11px;font-weight:700;cursor:pointer;transition:filter 0.15s;height:32px;box-sizing:border-box;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='none'">Go</button>
                </form>
                <select id="rankFilterSelect">
                  <option value="" data-i18n="allRanks">All ranks</option>
                </select>
                <button id="myCharacterFilterBtn" type="button">Character: -</button>
                <div id="playerStatsChip" style="display:flex;align-items:center;gap:10px;padding:3px 14px;background:var(--panel-2);border:1px solid var(--border);border-radius:999px;font-size:11px;color:var(--text);position:relative;">
                  <div style="display:flex;flex-direction:column;gap:1px;line-height:1.3;">
                    <span title="Nakit">💰 <span id="playerMoneyValue">-</span></span>
                    <span title="Banka" style="color:var(--muted);">🏦 <span id="playerBankValue">-</span></span>
                  </div>
                  <span style="color:var(--border);">|</span>
                  <div style="display:flex;flex-direction:column;gap:1px;line-height:1.3;">
                    <span title="Mermi">🔫 <span id="playerBulletsValue">-</span></span>
                    <span title="Sağlık" style="color:var(--muted);">❤️ <span id="playerHealthValue">-</span></span>
                  </div>
                </div>
                <button id="expToggleBtn" type="button" title="Hesap Tecrübeleri" style="display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;background:var(--panel-2);border:1px solid var(--border);font-size:18px;cursor:pointer;padding:0;">📊</button>
                <a id="gamblingLink" href="#" target="_blank" rel="noopener noreferrer" title="Kumarhane" style="display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;background:var(--panel-2);border:1px solid var(--border);font-size:20px;text-decoration:none;cursor:pointer;">🎲</a>
                <button id="obayCompactBtn" type="button" title="Obay Açık Artırma" style="display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;background:var(--panel-2);border:1px solid var(--border);padding:3px;cursor:pointer;overflow:hidden;"><img src="https://barafranca.com/static/images/game/generic/obay.gif" alt="Obay" style="width:30px;height:30px;object-fit:contain;display:block;"></button>
                </div>
              </div>
              <div class="cooldowns-header-links">
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

          <section id="chatWorkspace" class="portal-workspace">
            <section id="gameChatsPanel" class="panel game-chats-panel">
              <div class="panel-header portal-chat-header">
                <div>
                  <div class="panel-title">Game Chats</div>
                </div>
                <div class="portal-chat-meta">
                  <span id="gameChatSyncLabel"></span>
                  <div id="gameChatServerMeta" class="game-clock-display"></div>
                  <button id="chatSoundToggleBtn" type="button" class="button" style="padding: 4px 8px; font-size: 10px; background: var(--panel-2); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; color: var(--text); font-weight: bold; flex-shrink: 0;" onclick="toggleChatSound()">
                    ğŸ”Š Sound: ON
                  </button>
                </div>
              </div>
              <div class="dual-chat-grid">
                <section class="game-chat-card general">
                  <div class="chat-column-header">
                    <div class="chat-column-title"><div id="gameGeneralFeedback" class="feedback"></div><span data-i18n="general">General</span></div>
                    <div id="gameGeneralCaption" class="chat-column-caption">No server selected</div>
                  </div>
                  <div id="gameGeneralMessages" class="chat-messages compact">
                    <div class="chat-empty">Loading general chat...</div>
                  </div>
                  <form id="gameGeneralForm" class="chat-form compact">
                    <div class="chat-compose-row">
                      <textarea id="gameGeneralInput" class="input" maxlength="300" placeholder="General kanalına yaz..." data-i18n-placeholder="generalPlaceholder"></textarea>
                      <button id="gameGeneralSendBtn" class="button" type="submit" data-i18n="send">Send</button>
                    </div>
                  </form>
                </section>

                <section class="game-chat-card crimes">
                  <div class="chat-column-header">
                    <div class="chat-column-title"><div id="gameCrimesFeedback" class="feedback"></div><span data-i18n="crimes">Crimes</span></div>
                    <div id="gameCrimesCaption" class="chat-column-caption">No server selected</div>
                  </div>
                  <div id="gameCrimesMessages" class="chat-messages compact">
                    <div class="chat-empty">Loading crimes chat...</div>
                  </div>
                  <form id="gameCrimesForm" class="chat-form compact">
                    <div class="chat-compose-row">
                      <textarea id="gameCrimesInput" class="input" maxlength="300" placeholder="Crimes kanalına yaz..." data-i18n-placeholder="crimesPlaceholder"></textarea>
                      <button id="gameCrimesSendBtn" class="button" type="submit" data-i18n="send">Send</button>
                    </div>
                  </form>
                </section>
              </div>
            </section>

            <aside id="chatPanel" class="panel private-chat-panel" style="position: relative;">
          <div class="panel-header portal-chat-header" style="padding: 10px 14px; gap: 6px;">
            <div style="flex: 1; min-width: 0; overflow: hidden;">
              <div id="privateChatTitle" class="panel-title">Private Chat</div>
              <div id="chatPanelTitle" class="status-line" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="Room Name">Portal General</div>
              <div id="chatMeta" class="status-line">No messages loaded.</div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center; flex-shrink: 0;">
            </div>
          </div>
          <div class="private-panel-body">
            <div class="private-room-sidebar">
              <div class="private-room-sidebar-title">Portal Channels</div>
              <div id="roomTabsContainer" class="room-tab-stack"></div>
              <div class="private-room-actions">
                <input id="newRoomInput" class="input" type="text" placeholder="Room Name..." maxlength="32">
                <div class="private-room-action-row">
                  <button id="createRoomBtn" class="button" type="button">Create</button>
                  <button id="joinRoomBtn" class="button" type="button">Join</button>
                </div>
              </div>
            </div>
            <div id="privateChatMain" class="private-chat-main">
              <div class="private-chat-stage">
                <div class="private-panel-topline"></div>
                
          <!-- Collapsible Targets & Notes Panel body (overlay, does not push chat down) -->
          <div id="notesPanel" class="chat-notes-panel" style="display: none; position: absolute; bottom: 36px; left: 50%; right: 0; z-index: 50; background: #161b24; border: 1px solid var(--border); border-top: 2px solid var(--accent); border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,0.80); max-height: calc(100% - 44px); overflow-y: auto;">
            <div id="notesPanelBody" style="padding: 10px 12px 12px 12px; background: #1a2030;">
              <!-- Targets Tab View -->
              <div id="tabTargetsView">
                <form id="addTargetForm" style="display: flex; gap: 6px; margin-bottom: 8px;" onsubmit="handleNewTarget(event)">
                  <input id="targetNameInput" class="input" type="text" placeholder="Target name..." style="flex: 1; min-width: 0; padding: 4px 8px; font-size: 11px; height: 26px;" autocomplete="off" required>
                  <button type="submit" class="button" style="padding: 0 10px; font-size: 11px; font-weight: bold; height: 26px;">Add</button>
                </form>
                <div id="targetsListContainer" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 6px; padding-right: 2px;">
                  <span class="muted" style="font-size: 10px;">No targets added yet.</span>
                </div>
              </div>
              <!-- Notes Tab View -->
              <div id="tabNotesView" style="display: none;">
                <form id="addNoteForm" style="display: flex; gap: 6px; margin-bottom: 8px;" onsubmit="handleNewNote(event)">
                  <input id="noteTextInput" class="input" type="text" placeholder="Note text (safehouse coords, planning)..." style="flex: 1; min-width: 0; padding: 4px 8px; font-size: 11px; height: 26px;" autocomplete="off" required>
                  <button type="submit" class="button" style="padding: 0 10px; font-size: 11px; font-weight: bold; height: 26px;">Add</button>
                </form>
                <div id="notesListContainer" style="display: flex; flex-direction: column; gap: 6px; padding-right: 2px;">
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
              <button class="chat-shortcut" type="button" data-template="Heist"><span class="shortcut-label">🔎 Heist</span><span class="shortcut-ready-badge"></span><span class="shortcut-locked-icon">🔒</span></button>
              <button class="chat-shortcut" type="button" data-template="OC"><span class="shortcut-label">🔎 OC</span><span class="shortcut-ready-badge"></span><span class="shortcut-locked-icon">🔒</span></button>
              <button class="chat-shortcut" type="button" data-template="MOC"><span class="shortcut-label">🔎 MOC</span><span class="shortcut-ready-badge"></span><span class="shortcut-locked-icon">🔒</span></button>
              <button class="chat-shortcut" type="button" data-template="Race"><span class="shortcut-label">🔎 Race</span><span class="shortcut-ready-badge"></span><span class="shortcut-locked-icon">🔒</span></button>
            </div>
            <div class="chat-row" style="position: relative; display: flex; gap: 6px;">
              <textarea id="messageInput" class="input" maxlength="300" placeholder="Oda mesajı yaz..." style="flex: 1;"></textarea>
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
          </section>

        </div>
      </div>

    <script>
      // ─── i18n Translation System ─────────────────────────────────────────────
      const LANG = {
        tr: {
          downloadExtension: 'Eklentiyi İndir',
          connect: '↻ Synch',
          // Topbar / Nicknames
          // Cooldowns panel
          noRoomSelected: 'Oda seçilmedi.',
          playerName: 'Oyuncu Adı',
          rank: 'Rütbe',
          progress: 'İlerleme',
          activity: 'Aktivite',
          // Game Chats
          gameChats: 'Oyun Sohbetleri',
          soundOn: '🔊 Ses: AÇIK',
          soundOff: '🔇 Ses: KAPALI',
          // Private Chat panel
          privateChat: 'Özel Sohbet',
          portalChannels: 'Portal Kanalları',
          portalGeneral: 'Portal General',
          noMessagesLoaded: 'Mesaj yüklenmedi.',
          selectRoomToChat: 'Oda seçin ve sohbet başlatın.',
          writeMessage: 'Oda mesajı yaz...',
          sendMessage: 'Gönder',
          roomName: 'Oda adı...',
          createRoom: 'Oda Oluştur',
          joinRoom: 'Katıl',
          // Targets & Notes
          targets: 'Hedefler',
          notes: 'Notlar',
          targetsBtn: '🎯 Hedefler',
          notesBtn: '📝 Notlar',
          targetNamePlaceholder: 'Hedef adı...',
          addTarget: 'Ekle',
          noTargetsYet: 'Henüz hedef eklenmedi.',
          notePlaceholder: 'Not metni (safehouse koordinatları, planlama)...',
          addNote: 'Ekle',
          noNotesYet: 'Henüz not eklenmedi.',
          // Admin
          admin: '🛡️ Admin',
          pending: 'Bekleyenler:',
          members: 'Üyeler:',
          roomAdmin: 'Oda Yönetimi',
          // Access
          accessRestricted: 'Erişim Kısıtlandı',
          notMember: 'Bu odanın üyesi değilsiniz.',
          joinRoom2: 'Odaya Katıl',
          // Shortcuts
          shortcutHeist: 'Soygun',
          shortcutOC: 'ÖS',
          shortcutMOC: 'MÖS',
          shortcutRace: 'Yarış',
          // Notifications
          addedAsTarget: 'HEDEF olarak eklendi',
          markedDead: 'ÖLDÜ olarak işaretlendi',
          markedAlive: 'YAŞIYOR olarak işaretlendi',
          added: 'ekledi',
          marked: 'işaretledi',
          asTarget: 'HEDEF olarak',
          asDead: 'ÖLDÜ olarak',
          asAlive: 'YAŞIYOR olarak',
          // Dead toggle
          markDead: '☠️ Öldü',
          markAlive: '✅ Yaşıyor',
          removeTarget: '🗑️ Kaldır',
        },
        en: {
          downloadExtension: 'Download Extension',
          connect: '↻ Synch',
          noRoomSelected: 'No room selected.',
          playerName: 'Player Name',
          rank: 'Rank',
          progress: 'Progress',
          activity: 'Activity',
          gameChats: 'Game Chats',
          soundOn: '🔊 Sound: ON',
          soundOff: '🔇 Sound: OFF',
          privateChat: 'Private Chat',
          portalChannels: 'Portal Channels',
          portalGeneral: 'Portal General',
          noMessagesLoaded: 'No messages loaded.',
          selectRoomToChat: 'Select a room to load chat.',
          writeMessage: 'Write a room message...',
          sendMessage: 'Send Message',
          roomName: 'Room Name...',
          createRoom: 'Create Room',
          joinRoom: 'Join',
          targets: 'Targets',
          notes: 'Notes',
          targetsBtn: '🎯 Targets',
          notesBtn: '📝 Notes',
          targetNamePlaceholder: 'Target name...',
          addTarget: 'Add',
          noTargetsYet: 'No targets added yet.',
          notePlaceholder: 'Note text (safehouse coords, planning)...',
          addNote: 'Add',
          noNotesYet: 'No notes added yet.',
          admin: '🛡️ Admin',
          pending: 'Pending:',
          members: 'Members:',
          roomAdmin: 'Room Administration',
          accessRestricted: 'Access Restricted',
          notMember: 'You are not a member of this room.',
          joinRoom2: 'Join Room',
          shortcutHeist: 'Heist',
          shortcutOC: 'OC',
          shortcutMOC: 'MOC',
          shortcutRace: 'Race',
          addedAsTarget: 'added as TARGET',
          markedDead: 'marked as DEAD',
          markedAlive: 'marked as ALIVE',
          added: 'added',
          marked: 'marked',
          asTarget: 'as TARGET',
          asDead: 'as DEAD',
          asAlive: 'as ALIVE',
          markDead: '☠️ Dead',
          markAlive: '✅ Alive',
          removeTarget: '🗑️ Remove',
        }
      };

      Object.assign(LANG.tr, {
        downloadExtension: "Eklentiyi Indir",
        connect: "↻ Synch",
        noRoomSelected: "Oda secilmedi.",
        playerName: "Oyuncu Adi",
        rank: "Rutbe",
        progress: "Ilerleme",
        activity: "Aktivite",
        gameChats: "Oyun Sohbetleri",
        general: "General",
        crimes: "Crimes",
        soundOn: "🔊 Ses: ACIK",
        soundOff: "🔇 Ses: KAPALI",
        privateChat: "Ozel Sohbet",
        portalChannels: "Portal Kanallari",
        portalGeneral: "Portal General",
        noMessagesLoaded: "Mesaj yuklenmedi.",
        selectRoomToChat: "Oda secin ve sohbet baslatin.",
        writeMessage: "Oda mesaji yaz...",
        send: "Gonder",
        sendMessage: "Gonder",
        roomName: "Oda adı...",
        createRoom: "Oda Oluştur",
        join: "Katıl",
        joinRoom: "Katıl",
        targets: "Hedefler",
        notes: "Notlar",
        targetsBtn: "🎯 Hedefler",
        notesBtn: "📝 Notlar",
        targetNamePlaceholder: "Hedef adı...",
        addTarget: "Ekle",
        noTargetsYet: "Henuz hedef eklenmedi.",
        notePlaceholder: "Not metni (safehouse koordinatları, planlama)...",
        addNote: "Ekle",
        noNotesYet: "Henuz not eklenmedi.",
        admin: "🛡️ Admin",
        pending: "Bekleyenler:",
        members: "Uyeler:",
        roomAdmin: "Oda Yonetimi",
        accessRestricted: "Erisim Kisıtlandi",
        notMember: "Bu odanin uyesi degilsiniz.",
        joinRoom2: "Odaya Katil",
        shortcutHeist: "Heist",
        shortcutOC: "OC",
        shortcutMOC: "MOC",
        shortcutRace: "Race",
        templateVerb: "Ariyor",
        added: "ekledi",
        marked: "isaretledi",
        asTarget: "TARGET olarak",
        asDead: "DEAD olarak",
        asAlive: "ALIVE olarak",
        markDead: "☠️ Olu",
        markAlive: "✅ Yasiyor",
        removeTarget: "🗑️ Kaldir",
        searchPlayerProfile: "Oyuncu profili ara...",
        allRanks: "Tüm Seviyeler",
        character: "Karakter",
        generalPlaceholder: "General kanalina yaz...",
        crimesPlaceholder: "Crimes kanalina yaz...",
        privatePlaceholder: "Oda mesaji yaz...",
        noMessagesYet: "Henuz mesaj yok",
        loadingGeneralChat: "General sohbeti yukleniyor...",
        loadingCrimesChat: "Crimes sohbeti yukleniyor...",
        noPrivateChatPanel: "Portal General ozel sohbet paneline sahip degil.",
        portalGeneralControlsOnly: "Portal General sadece oyuncu tablosunu kontrol eder.",
        emptyPrivate: "Portal General sadece oyuncu tablosunu kontrol eder. Sohbet icin TestRoom veya ozel oda sec.",
        targetWord: "TARGET",
        deadWord: "DEAD",
        aliveWord: "ALIVE",
        templateVerb: "Arıyor"
      });

      Object.assign(LANG.en, {
        general: "General",
        crimes: "Crimes",
        send: "Send",
        join: "Join",
        sendMessage: "Send",
        roomName: "Room name...",
        searchPlayerProfile: "Search player profile...",
        allRanks: "All ranks",
        character: "Character",
        generalPlaceholder: "Write to general chat...",
        crimesPlaceholder: "Write to crimes chat...",
        privatePlaceholder: "Write a room message...",
        noMessagesYet: "No messages yet",
        loadingGeneralChat: "Loading general chat...",
        loadingCrimesChat: "Loading crimes chat...",
        noPrivateChatPanel: "Portal General has no private chat panel.",
        portalGeneralControlsOnly: "Portal General controls the player table only.",
        emptyPrivate: "Portal General controls the player table. Select TestRoom or a private room to use portal chat.",
        targetWord: "TARGET",
        deadWord: "DEAD",
        aliveWord: "ALIVE"
      });

      Object.assign(LANG.tr, {
        roomName: "Oda ad\u0131...",
        createRoom: "Oda Olu\u015Ftur",
        join: "Kat\u0131l",
        joinRoom: "Kat\u0131l",
        joinRoom2: "Odaya Kat\u0131l",
        targetNamePlaceholder: "Hedef ad\u0131...",
        notePlaceholder: "Not metni (safehouse koordinatlar\u0131, planlama)...",
        accessRestricted: "Eri\u015Fim K\u0131s\u0131tland\u0131",
        notMember: "Bu odan\u0131n \u00FCyesi de\u011Filsiniz.",
        marked: "i\u015Faretledi",
        allRanks: "Seviyeler",
        noPrivateChatPanel: "Portal General \u00F6zel sohbet paneline sahip de\u011Fil.",
        emptyPrivate: "Portal General sadece oyuncu tablosunu kontrol eder. Sohbet i\u00E7in TestRoom veya \u00F6zel oda se\u00E7.",
        templateVerb: "Ar\u0131yor",
        city: "City",
        mailLabel: "Mesajlar"
      });

      Object.assign(LANG.en, {
        allRanks: "Ranks",
        city: "City",
        mailLabel: "Messages"
      });

      let currentLang = localStorage.getItem('omerta_lang') === 'en' ? 'en' : 'tr';

      function t(key) {
        return (LANG[currentLang] && LANG[currentLang][key]) || (LANG['en'][key]) || key;
      }

      function setLang(lang) {
        currentLang = lang === "en" ? "en" : "tr";
        uiMessages = LANG[currentLang] || LANG.en;
        localStorage.setItem('omerta_lang', currentLang);
        // Update flag button active states
        document.getElementById('langBtnTR').classList.toggle('active', lang === 'tr');
        document.getElementById('langBtnEN').classList.toggle('active', lang === 'en');
        applyLanguage();
      }

      function applyLanguage() {
        const L = LANG[currentLang] || LANG.en;
        uiMessages = L;
        // All data-i18n elements
        document.querySelectorAll('[data-i18n]').forEach(function(el) {
          const key = el.getAttribute('data-i18n');
          if (L[key]) el.textContent = L[key];
        });
        // Placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
          const key = el.getAttribute('data-i18n-placeholder');
          if (L[key]) el.placeholder = L[key];
        });
        const langBtnTR = document.getElementById('langBtnTR');
        const langBtnEN = document.getElementById('langBtnEN');
        if (langBtnTR) {
          langBtnTR.classList.toggle('active', currentLang === 'tr');
          langBtnTR.innerHTML = '<span class="lang-label">TR</span><svg class="flag-icon" width="24" height="16" viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg"><rect width="30" height="20" fill="#E30A17"/><circle cx="11.5" cy="10" r="5.5" fill="white"/><circle cx="13.5" cy="10" r="4.3" fill="#E30A17"/><polygon fill="white" points="18.5,10 20,7.5 22.5,9 20.5,6.8 22.5,4.5 20,6 18.5,3.5 18.5,6.2 16,4.5 18,7 16,9.2 18.5,7.7"/></svg>';
        }
        if (langBtnEN) {
          langBtnEN.classList.toggle('active', currentLang === 'en');
          langBtnEN.innerHTML = '<span class="lang-label">ENG</span><svg class="flag-icon" width="24" height="16" viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg"><rect width="30" height="20" fill="white"/><rect x="12.5" width="5" height="20" fill="#CF142B"/><rect y="7.5" width="30" height="5" fill="#CF142B"/></svg>';
        }
        // Connect button
        const connectBtn = document.getElementById('dashboardConnectBtn');
        if (connectBtn) connectBtn.textContent = L.connect;
        // Download link
        const dlLink = document.getElementById('downloadExtensionLink');
        if (dlLink) dlLink.textContent = L.downloadExtension;
        // Sound button (game chats)
        const soundBtn = document.getElementById('chatSoundToggleBtn');
        if (soundBtn) {
          const isOn = soundBtn.textContent.includes('ON') || soundBtn.textContent.includes('AÇIK');
          soundBtn.textContent = isOn ? L.soundOn : L.soundOff;
        }
        // Unauthorized panel
        const uTitle = document.getElementById('unauthorizedTitle');
        if (uTitle) uTitle.textContent = L.accessRestricted;
        const uMsg = document.getElementById('unauthorizedMessage');
        if (uMsg) uMsg.textContent = L.notMember;
        const uBtn = document.getElementById('unauthorizedJoinBtn');
        if (uBtn) uBtn.textContent = L.joinRoom2;
        // No room selected in table
        const noRoomTd = document.querySelector('#cooldownTableBody td.muted');
        if (noRoomTd) noRoomTd.textContent = L.noRoomSelected;
        // Game Chats panel title
        const gcTitle = document.querySelector('.game-chats-panel .panel-title');
        if (gcTitle) gcTitle.textContent = L.gameChats;
        // Private Chat elements (may not exist if not rendered yet)
        const pcTitle = document.getElementById('privateChatTitle');
        if (pcTitle) pcTitle.textContent = L.privateChat;
        const pcSidebar = document.querySelector('.private-room-sidebar-title');
        if (pcSidebar) pcSidebar.textContent = L.portalChannels;
        // Message input placeholder
        const msgInput = document.getElementById('messageInput');
        if (msgInput) msgInput.placeholder = L.writeMessage;
        // Send button
        const sendBtn = document.getElementById('privateChatSendBtn');
        if (sendBtn) sendBtn.textContent = L.sendMessage;
        // Room name input placeholder
        const roomInput2 = document.getElementById('newRoomInput');
        if (roomInput2) roomInput2.placeholder = L.roomName;
        // Join button
        const joinBtn = document.getElementById('joinRoomBtn');
        if (joinBtn) joinBtn.textContent = L.join || L.joinRoom;
        // Admin button
        const adminBtn = document.getElementById('chatAdminToggleBtn');
        if (adminBtn) adminBtn.textContent = L.admin;
        // Targets & Notes header buttons
        const targetsBtn = document.getElementById('headerTargetsBtn');
        const targetsCount = document.getElementById('targetsCount');
        if (targetsBtn && targetsCount) {
          targetsBtn.innerHTML = L.targetsBtn + ' (<span id="targetsCount">' + targetsCount.textContent + '</span>)';
        }
        const notesBtn = document.getElementById('headerNotesBtn');
        const notesCount = document.getElementById('notesCount');
        if (notesBtn && notesCount) {
          notesBtn.innerHTML = L.notesBtn + ' (<span id="notesCount">' + notesCount.textContent + '</span>)';
        }
        // Target name input placeholder
        const targetInput = document.getElementById('targetNameInput');
        if (targetInput) targetInput.placeholder = L.targetNamePlaceholder;
        // Note text input placeholder
        const noteInput = document.getElementById('noteTextInput');
        if (noteInput) noteInput.placeholder = L.notePlaceholder;
        // Add target button
        const addTargetBtn = document.querySelector('#addTargetForm button[type="submit"]');
        if (addTargetBtn) addTargetBtn.textContent = L.addTarget;
        // Add note button
        const addNoteBtn = document.querySelector('#addNoteForm button[type="submit"]');
        if (addNoteBtn) addNoteBtn.textContent = L.addNote;
        // Empty state placeholders
        const noTargets = document.querySelector('#targetsListContainer > .muted');
        if (noTargets) noTargets.textContent = L.noTargetsYet;
        const noNotes = document.querySelector('#notesListContainer > .muted');
        if (noNotes) noNotes.textContent = L.noNotesYet;
        // Shortcut buttons
        const shortcuts = document.querySelectorAll('.chat-shortcut[data-template]');
        shortcuts.forEach(function(btn) {
          const tpl = btn.getAttribute('data-template');
          const lbl = btn.querySelector('.shortcut-label');
          if (!lbl) return;
          if (tpl === 'Heist' && L.shortcutHeist) lbl.textContent = L.shortcutHeist;
          else if (tpl === 'OC' && L.shortcutOC) lbl.textContent = L.shortcutOC;
          else if (tpl === 'MOC' && L.shortcutMOC) lbl.textContent = L.shortcutMOC;
          else if (tpl === 'Race' && L.shortcutRace) lbl.textContent = L.shortcutRace;
        });
        // Admin panel title & labels
        const adminTitle = document.querySelector('#chatAdminPanel span[style*="yellow"]');
        if (adminTitle) adminTitle.textContent = L.roomAdmin;
        const pendingLabel = document.querySelector('#chatAdminPanel div[style*="yellow"][style*="font-weight"]');
        if (pendingLabel) pendingLabel.textContent = L.pending;
        const membersLabel = document.querySelector('#chatAdminPanel div[style*="accent"][style*="font-weight"]');
        if (membersLabel) membersLabel.textContent = L.members;
        // Dead/alive toggle buttons in targets list
        document.querySelectorAll('.target-dead-btn').forEach(function(btn) {
          const isDead = btn.getAttribute('data-dead') === '1';
          btn.textContent = isDead ? L.markAlive : L.markDead;
        });
        document.querySelectorAll('.target-remove-btn').forEach(function(btn) {
          btn.textContent = L.removeTarget;
        });
        // Chat empty state
        const chatEmpty = document.querySelector('.chat-empty');
        if (chatEmpty) chatEmpty.textContent = L.selectRoomToChat;
        const generalEmpty = document.querySelector('#gameGeneralMessages .chat-empty');
        if (generalEmpty) generalEmpty.textContent = L.loadingGeneralChat || generalEmpty.textContent;
        const crimesEmpty = document.querySelector('#gameCrimesMessages .chat-empty');
        if (crimesEmpty) crimesEmpty.textContent = L.loadingCrimesChat || crimesEmpty.textContent;
        // Private chat idle state
        const idleState = document.getElementById('privateChatEmptyState');
        if (idleState) idleState.textContent = uiMessages.emptyPrivate || L.selectRoomToChat;
        const rankDefault = document.querySelector('#rankFilterSelect option[value=""]');
        if (rankDefault && L.allRanks) rankDefault.textContent = L.allRanks;
        const characterBtn = document.getElementById('myCharacterFilterBtn');
        if (characterBtn && !myPlayerName) characterBtn.textContent = t("character") + ": -";
        updateSoundButtonState();
        updateCityShortcutButton();
        const soundBtnLang = document.getElementById('chatSoundToggleBtn');
        if (soundBtnLang) soundBtnLang.textContent = uiMessages.soundOn && uiMessages.soundOff
          ? (isChatSoundEnabled ? uiMessages.soundOn : uiMessages.soundOff)
          : soundBtnLang.textContent;
        if (langBtnTR) langBtnTR.innerHTML = '<span class="lang-label">TR</span><svg class="flag-icon" width="24" height="16" viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg"><rect width="30" height="20" fill="#E30A17"/><circle cx="11.5" cy="10" r="5.5" fill="white"/><circle cx="13.5" cy="10" r="4.3" fill="#E30A17"/><polygon fill="white" points="18.5,10 20,7.5 22.5,9 20.5,6.8 22.5,4.5 20,6 18.5,3.5 18.5,6.2 16,4.5 18,7 16,9.2 18.5,7.7"/></svg>';
        if (langBtnEN) langBtnEN.innerHTML = '<span class="lang-label">ENG</span><svg class="flag-icon" width="24" height="16" viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg"><rect width="30" height="20" fill="white"/><rect x="12.5" width="5" height="20" fill="#CF142B"/><rect y="7.5" width="30" height="5" fill="#CF142B"/></svg>';
      }

      const applyLang = applyLanguage;
      // ─── End i18n ─────────────────────────────────────────────────────────────

      const chatPanelRoot = document.getElementById("chatPanel");
      if (chatPanelRoot) {
        chatPanelRoot.className = "panel chat";
        chatPanelRoot.innerHTML = \`
          <div class="panel-header private-chat-header">
            <div style="flex: 1; min-width: 0; overflow: hidden;">
              <div id="chatPanelTitle" class="panel-title" style="display: none;" title="Room Name">Room</div>
              <div id="chatMeta" class="status-line" style="display: none;">No messages loaded.</div>
              <div id="roomTabsContainer" class="private-tabs-strip"></div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center; flex-shrink: 0;"></div>
          </div>
          <div class="private-panel-body">
            <div class="private-room-toolbar" style="display: none;"></div>
            <div id="privateChatMain" class="private-chat-main">
              <div class="private-chat-stage">
                <div class="private-panel-topline"></div>
                <div id="notesPanel" class="chat-notes-panel" style="display: none; position: absolute; bottom: 36px; left: 50%; right: 0; z-index: 50; background: #161b24; border: 1px solid var(--border); border-top: 2px solid var(--accent); border-radius: 10px; box-shadow: 0 -6px 32px rgba(0,0,0,0.80); max-height: calc(100% - 78px); overflow-y: auto;">
                  <div id="notesPanelBody" style="padding: 10px 12px 12px 12px; background: #1a2030;">
                    <div id="tabTargetsView">
                      <form id="addTargetForm" style="display: flex; gap: 6px; margin-bottom: 8px;" onsubmit="handleNewTarget(event)">
                        <input id="targetNameInput" class="input" type="text" placeholder="Target name..." style="flex: 1; min-width: 0; padding: 4px 8px; font-size: 11px; height: 26px;" autocomplete="off" required>
                        <button type="submit" class="button" style="padding: 0 10px; font-size: 11px; font-weight: bold; height: 26px;">Add</button>
                      </form>
                      <div id="targetsListContainer" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 6px; padding-right: 2px;">
                        <span class="muted" style="font-size: 10px;">No targets added yet.</span>
                      </div>
                    </div>
                    <div id="tabNotesView" style="display: none;">
                      <form id="addNoteForm" style="display: flex; gap: 6px; margin-bottom: 8px;" onsubmit="handleNewNote(event)">
                        <input id="noteTextInput" class="input" type="text" placeholder="Note text (safehouse coords, planning)..." style="flex: 1; min-width: 0; padding: 4px 8px; font-size: 11px; height: 26px;" autocomplete="off" required>
                        <button type="submit" class="button" style="padding: 0 10px; font-size: 11px; font-weight: bold; height: 26px;">Add</button>
                      </form>
                      <div id="notesListContainer" style="display: flex; flex-direction: column; gap: 6px; padding-right: 2px;">
                        <span class="muted" style="font-size: 10px;">No notes added yet.</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div id="chatAdminPanel" style="display: none; position: absolute; top: 52px; left: 194px; right: 12px; background: #171d27; border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7); z-index: 100; padding: 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding-bottom: 6px;">
                    <span style="font-size: 11px; font-weight: bold; color: var(--yellow);">Room Administration</span>
                    <button type="button" style="font-size: 14px; color: var(--muted); border: none; background: transparent; cursor: pointer; line-height: 1; padding: 0 4px;" onclick="toggleChatAdmin()">x</button>
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
                <div id="privateChatEmptyState" class="private-chat-empty-state">Portal General controls the player table. Select TestRoom or a private room to use portal chat.</div>
                <div id="chatMessages" class="chat-messages">
                  <div class="chat-empty">Select a room to load chat.</div>
                </div>
                <form id="chatForm" class="chat-form">
                  <div class="private-chat-controls-row">
                    <div class="chat-shortcuts">
                      <button class="chat-shortcut" type="button" data-template="Heist"><span class="shortcut-label">Heist</span><span class="shortcut-ready-badge"></span><span class="shortcut-locked-icon">🔒</span></button>
                      <button class="chat-shortcut" type="button" data-template="OC"><span class="shortcut-label">OC</span><span class="shortcut-ready-badge"></span><span class="shortcut-locked-icon">🔒</span></button>
                      <button class="chat-shortcut" type="button" data-template="MOC"><span class="shortcut-label">MOC</span><span class="shortcut-ready-badge"></span><span class="shortcut-locked-icon">🔒</span></button>
                      <button class="chat-shortcut" type="button" data-template="Race"><span class="shortcut-label">Race</span><span class="shortcut-ready-badge"></span><span class="shortcut-locked-icon">🔒</span></button>
                    </div>
                    <button id="cityShortcutBtn" class="chat-shortcut city-shortcut-button" type="button" title="City">City<span class="city-shortcut-badge">&#x1F381;</span></button>
                    <div class="private-room-inline">
                      <div class="private-room-inline-wrap">
                        <input id="newRoomInput" class="input" type="text" placeholder="Room Name..." maxlength="32">
                        <button id="createRoomBtn" class="button" type="button" title="Create room">+</button>
                      </div>
                      <button id="joinRoomBtn" class="button" type="button">Join</button>
                    </div>
                  </div>
                  <div class="chat-row" style="position: relative; display: flex; gap: 6px;">
                    <textarea id="messageInput" class="input" maxlength="300" placeholder="Oda mesajı yaz..." style="flex: 1;"></textarea>
                    <button id="emojiButton" class="button" type="button" style="padding: 0 10px; font-size: 16px; background: var(--panel-2); border-color: var(--border);" title="Insert Emoji">😀</button>
                    <button id="privateChatSendBtn" class="button" type="submit">Send Message</button>
                    <div id="emojiPanel" style="display: none; position: absolute; bottom: 100%; right: 0; background: var(--panel-2); border: 1px solid var(--border); border-radius: 10px; padding: 6px; width: 220px; grid-template-columns: repeat(6, 1fr); gap: 4px; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
                      <span class="emoji-item">😀</span><span class="emoji-item">😁</span><span class="emoji-item">😂</span><span class="emoji-item">🤣</span><span class="emoji-item">😎</span><span class="emoji-item">😍</span><span class="emoji-item">😘</span><span class="emoji-item">😡</span><span class="emoji-item">😭</span><span class="emoji-item">👍</span><span class="emoji-item">👎</span><span class="emoji-item">✅</span><span class="emoji-item">❌</span><span class="emoji-item">🔥</span><span class="emoji-item">💀</span><span class="emoji-item">🎯</span><span class="emoji-item">🚀</span><span class="emoji-item">💰</span><span class="emoji-item">🔫</span><span class="emoji-item">🛡️</span><span class="emoji-item">🍺</span><span class="emoji-item">💊</span>
                    </div>
                  </div>
                  <div class="chat-row">
                    <div id="chatFeedback" class="feedback" style="display: none;"></div>
                  </div>
                </form>
              </div>
            </div>
            <!-- Bottom toolbar: outside private-chat-main, inside private-panel-body -->
            <div style="display:flex;align-items:center;padding:8px 0 0 0;gap:6px;">
              <button id="chatAdminToggleBtn" type="button" class="button" style="display:none;height:26px;padding:0 10px;font-size:10px;background:var(--panel-2);border:1px solid var(--border);border-radius:6px;cursor:pointer;color:var(--yellow);font-weight:bold;white-space:nowrap;box-sizing:border-box;" onclick="toggleChatAdmin()">&#x1F6E1;&#xFE0F; Admin</button>
              <div style="display:flex;gap:6px;align-items:center;margin-left:auto;">
                <button id="headerMailBtn" type="button" class="button mail-shortcut-button" style="height:26px;padding:0 8px;font-size:10px;background:var(--panel-2);border:1px solid var(--border);border-radius:6px;cursor:pointer;color:var(--muted);font-weight:bold;white-space:nowrap;box-sizing:border-box;">📬 Mesajlar (<span id="mailUnreadCount">0</span>)</button>
                <div id="notesPanelHeaderButtons" style="display:none;gap:6px;align-items:center;">
                  <button id="headerTargetsBtn" type="button" class="button" style="height:26px;padding:0 8px;font-size:10px;background:var(--panel-2);border:1px solid var(--border);border-radius:6px;cursor:pointer;color:var(--muted);font-weight:bold;white-space:nowrap;box-sizing:border-box;" onclick="toggleHeaderTab('targets')">&#x1F3AF; Hedefler (<span id="targetsCount">0</span>)</button>
                  <button id="headerNotesBtn" type="button" class="button" style="height:26px;padding:0 8px;font-size:10px;background:var(--panel-2);border:1px solid var(--border);border-radius:6px;cursor:pointer;color:var(--muted);font-weight:bold;white-space:nowrap;box-sizing:border-box;" onclick="toggleHeaderTab('notes')">&#x1F4DD; Notlar (<span id="notesCount">0</span>)</button>
                </div>
              </div>
            </div>
          </div>\`;
      }

      const roomInput = document.getElementById("roomInput");
      const applyRoomButton = document.getElementById("applyRoomButton");
      const roomTitle = document.getElementById("roomTitle");
      const stateMeta = document.getElementById("stateMeta");
      const rankSortButton = document.getElementById("rankSortButton");
      const rankFilterSelect = document.getElementById("rankFilterSelect");
      const myCharacterFilterBtn = document.getElementById("myCharacterFilterBtn");
      const dashboardConnectBtn = document.getElementById("dashboardConnectBtn");
      const nicknamePlayerTR = document.getElementById("nicknamePlayerTR");
      const nicknamePlayerCOM = document.getElementById("nicknamePlayerCOM");
      const nicknamePlayerNL = document.getElementById("nicknamePlayerNL");
      const nicknamePlayerPT = document.getElementById("nicknamePlayerPT");
      const chatMeta = document.getElementById("chatMeta");
      const cooldownTableBody = document.getElementById("cooldownTableBody");
      const chatMessages = document.getElementById("chatMessages");
      const chatForm = document.getElementById("chatForm");
      const messageInput = document.getElementById("messageInput");
      const chatFeedback = document.getElementById("chatFeedback");
      const chatPanelTitle = document.getElementById("chatPanelTitle");
      const privateChatMain = document.getElementById("privateChatMain");
      const privateChatTitle = document.getElementById("privateChatTitle");
      const privateRoomControlsLabel = document.getElementById("privateRoomControlsLabel");
      const privateChatEmptyState = document.getElementById("privateChatEmptyState");
      const privateChatSendBtn = document.getElementById("privateChatSendBtn");
      const gameChatServerMeta = document.getElementById("gameChatServerMeta");
      const gameChatSyncLabel = document.getElementById("gameChatSyncLabel");
      const gameGeneralCaption = document.getElementById("gameGeneralCaption");
      const gameCrimesCaption = document.getElementById("gameCrimesCaption");
      const gameGeneralMessages = document.getElementById("gameGeneralMessages");
      const gameCrimesMessages = document.getElementById("gameCrimesMessages");
      const gameGeneralForm = document.getElementById("gameGeneralForm");
      const gameCrimesForm = document.getElementById("gameCrimesForm");
      const gameGeneralInput = document.getElementById("gameGeneralInput");
      const gameCrimesInput = document.getElementById("gameCrimesInput");
      const gameGeneralSendBtn = document.getElementById("gameGeneralSendBtn");
      const gameCrimesSendBtn = document.getElementById("gameCrimesSendBtn");
      const gameGeneralFeedback = document.getElementById("gameGeneralFeedback");
      const gameCrimesFeedback = document.getElementById("gameCrimesFeedback");
      const dashboardNicknames = { tr: "-", com: "-", nl: "-", pt: "-" };

      let uiMessages = LANG[currentLang] || LANG.en;

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
      let latestState = null;
      let isConnected = false;
      let myPlayerName = "";
      let myClientId = "";
      let cachedSelfProgression = null;
      let userRoomStatus = "none";
      let isChatAdminOpen = false;
      let lastChatMsgTime = 0;
      let gameChatLastSeen = { general: 0, crimes: 0 };
      const gameChatSeenIds = { general: new Set(), crimes: new Set() };
      let lastGameChatServerId = null;
      var gameChatServerTimeBase = null;
      var gameChatClockInterval = null;
      function computeServerClock(baseTime, syncedAt) {
        var parts = String(baseTime).split(":");
        var h = parseInt(parts[0], 10) || 0;
        var m = parseInt(parts[1], 10) || 0;
        var s = parseInt(parts[2], 10) || 0;
        var total = h * 3600 + m * 60 + s + Math.floor((Date.now() - syncedAt) / 1000) + 3;
        total = ((total % 86400) + 86400) % 86400;
        var hh = Math.floor(total / 3600);
        var mm = Math.floor((total % 3600) / 60);
        var ss = total % 60;
        return (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm + ":" + (ss < 10 ? "0" : "") + ss;
      }
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

      function getGameChatRoomKey(kind) {
        const suffix = getActiveChatServerId().toUpperCase();
        return (kind === "crimes" ? "Crimes_" : "General_") + suffix;
      }

      function getGameChatRoomLabel(kind) {
        return getActiveChatServerId().toUpperCase();
      }

      function setConnectionIndicator(feedbackEl, state, titleText) {
        if (!feedbackEl) return;
        const safeState = state === "online" || state === "error" ? state : "offline";
        feedbackEl.className = "feedback connection-only";
        feedbackEl.textContent = "";
        feedbackEl.title = titleText || "";
        feedbackEl.innerHTML = '<span class="chat-connection-indicator" aria-label="' + escapeHtml(titleText || safeState) + '"><span class="chat-connection-dot ' + safeState + '"></span></span>';
      }

      function setPrivateChatIdleState(isIdle) {
        return;
      }

      function updateNotesButtonsText() {
        const targetsCountEl = document.getElementById("targetsCount");
        const notesCountEl = document.getElementById("notesCount");
        const mailUnreadCountEl = document.getElementById("mailUnreadCount");
        const targetsCount = targetsCountEl ? targetsCountEl.textContent : "0";
        const notesCount = notesCountEl ? notesCountEl.textContent : "0";
        const mailUnreadCount = mailUnreadCountEl ? mailUnreadCountEl.textContent : "0";
        const headerMailBtn = document.getElementById("headerMailBtn");
        const headerTargetsBtn = document.getElementById("headerTargetsBtn");
        const headerNotesBtn = document.getElementById("headerNotesBtn");
        if (headerMailBtn) headerMailBtn.innerHTML = escapeHtml(uiMessages.mailLabel || "Messages") + ' (<span id="mailUnreadCount">' + escapeHtml(mailUnreadCount) + "</span>)";
        if (headerTargetsBtn) headerTargetsBtn.innerHTML = "&#x1F3AF; " + escapeHtml(uiMessages.targets) + ' (<span id="targetsCount">' + escapeHtml(targetsCount) + "</span>)";
        if (headerNotesBtn) headerNotesBtn.innerHTML = "&#x1F4DD; " + escapeHtml(uiMessages.notes) + ' (<span id="notesCount">' + escapeHtml(notesCount) + "</span>)";
      }

      function getGamblingPageUrl(serverId) {
        const srv = String(serverId || activeServerFilter || "tr").toLowerCase();
        if (srv === "tr") return "https://omerta.com.tr/index.php#/gambling/gambling.php";
        if (srv === "com") return "https://barafranca.com/index.php#/gambling/gambling.php";
        if (srv === "nl") return "https://barafranca.nl/index.php#/gambling/gambling.php";
        if (srv === "pt") return "https://omerta.pt/index.php#/gambling/gambling.php";
        return "https://omerta.com.tr/index.php#/gambling/gambling.php";
      }

      function getCityPageUrl(serverId) {
        const srv = String(serverId || activeServerFilter || "tr").toLowerCase();
        if (srv === "tr") return "https://omerta.com.tr/index.php#/?module=City";
        if (srv === "com") return "https://barafranca.com/#/?module=City";
        if (srv === "nl") return "https://barafranca.nl/#/?module=City";
        if (srv === "pt") return "https://omerta.pt/index.php#/?module=City";
        return "https://omerta.com.tr/index.php#/?module=City";
      }

      function getMailPageUrl(serverId) {
        const srv = String(serverId || activeServerFilter || "tr").toLowerCase();
        if (srv === "tr") return "https://omerta.com.tr/index.php#/?module=Mail";
        if (srv === "com") return "https://barafranca.com/#/?module=Mail";
        if (srv === "nl") return "https://barafranca.nl/#/?module=Mail";
        if (srv === "pt") return "https://omerta.pt/index.php#/?module=Mail";
        return "https://omerta.com.tr/index.php#/?module=Mail";
      }

      function getActiveCityGiftState() {
        if (!latestState || !Array.isArray(latestState.players)) return false;
        const activeSrv = getActiveChatServerId();
        return latestState.players.some(function(player) {
          return String(player.serverId || "").toLowerCase() === activeSrv && player.cityGiftActive === true;
        });
      }

      function getActiveMailUnreadCount() {
        if (!latestState || !Array.isArray(latestState.players)) return 0;
        const activeSrv = getActiveChatServerId();
        const activePlayers = latestState.players.filter(function(player) {
          return String(player.serverId || "").toLowerCase() === activeSrv;
        });
        const byClient = latestState.players.find(function(player) {
          return String(player.serverId || "").toLowerCase() === activeSrv &&
            myClientId &&
            String(player.clientId || "") === String(myClientId || "");
        });
        if (byClient) {
          return Number(byClient.mailUnreadCount) || 0;
        }
        const byPlayer = latestState.players.find(function(player) {
          return String(player.serverId || "").toLowerCase() === activeSrv &&
            myPlayerName &&
            String(player.player || "") === String(myPlayerName || "");
        });
        if (byPlayer) {
          return Number(byPlayer.mailUnreadCount) || 0;
        }
        if (activePlayers.length > 0) {
          return activePlayers.reduce(function(maxCount, player) {
            const count = Number(player.mailUnreadCount) || 0;
            return count > maxCount ? count : maxCount;
          }, 0);
        }
        return 0;
      }

      function updateCityShortcutButton() {
        const cityBtn = document.getElementById("cityShortcutBtn");
        if (!cityBtn) return;
        const hasAlert = getActiveCityGiftState();
        if (hasAlert) console.log("[CityGift] dashboard active=true");
        cityBtn.classList.toggle("has-alert", hasAlert);
        cityBtn.title = hasAlert ? "City gift active" : (uiMessages.city || "City");
        cityBtn.innerHTML = escapeHtml(uiMessages.city || "City") + '<span class="city-shortcut-badge">&#x1F381;</span>';
      }

      const SHORTCUT_COOLDOWN_KEYS = {
        "Heist": ["heist"],
        "OC": ["organizedCrime", "organized_crime", "oc"],
        "MOC": ["megaOrganizedCrime", "mega_organized_crime", "megaOc", "mega_oc", "megaoc"],
        "Race": ["race"]
      };

      function isCooldownReady(value, serverTime) {
        if (!value || typeof value !== "object") return false;
        if (value.locked || value.censored) return false;
        if (value.ready === true || Number(value.timeEnd) === 0) return true;
        const timeEnd = Number(value.timeEnd);
        if (!Number.isFinite(timeEnd) || timeEnd <= 0) return false;
        return timeEnd <= serverTime;
      }

      function updateShortcutReadyBadges(state) {
        const buttons = document.querySelectorAll(".chat-shortcut[data-template]");
        if (!state || !Array.isArray(state.players) || !myPlayerName) {
          buttons.forEach(function(btn) { btn.classList.remove("has-ready-badge"); });
          return;
        }
        const nameLower = String(myPlayerName).toLowerCase();
        const activeSrv = (activeServerFilter || "").toLowerCase();
        let myEntry = (activeSrv && activeSrv !== "all")
          ? state.players.find(function(p) { return String(p.player || "").toLowerCase() === nameLower && (p.serverId || "").toLowerCase() === activeSrv; })
          : null;
        if (!myEntry) {
          myEntry = state.players.find(function(p) { return String(p.player || "").toLowerCase() === nameLower; });
        }
        console.log("[Badge] player=" + myPlayerName + " srv=" + activeSrv + " found=" + !!myEntry + " players=" + state.players.length);
        if (!myEntry) { buttons.forEach(function(btn) { btn.classList.remove("has-ready-badge"); btn.classList.remove("has-locked-badge"); }); return; }
        const srvTime = state.serverTime || 0;
        buttons.forEach(function(btn) {
          const label = btn.dataset.template;
          const keys = SHORTCUT_COOLDOWN_KEYS[label];
          if (!keys) { btn.classList.remove("has-ready-badge"); btn.classList.remove("has-locked-badge"); return; }
          const raw = getCooldownRawValue(myEntry.cooldowns, keys);
          const ready = isCooldownReady(raw, srvTime);
          const locked = !!(raw && raw.locked);
          btn.classList.toggle("has-ready-badge", ready);
          btn.classList.toggle("has-locked-badge", locked && !ready);
        });
      }

      function updateMailShortcutButton() {
        const mailBtn = document.getElementById("headerMailBtn");
        if (!mailBtn) return;
        const unreadCount = Math.max(0, getActiveMailUnreadCount());
        console.log("[Mail] dashboard value=", unreadCount);
        mailBtn.style.display = "inline-flex";
        mailBtn.innerHTML = escapeHtml(uiMessages.mailLabel || "Messages") + ' (<span id="mailUnreadCount">' + escapeHtml(String(unreadCount)) + "</span>)";
        mailBtn.title = unreadCount > 0 ? unreadCount + " unread mail" : "No unread mail";
      }

      function applyLocaleTexts() {
        if (privateChatTitle) privateChatTitle.textContent = uiMessages.privateChat || uiMessages.privateChatTitle;
        if (privateRoomControlsLabel) privateRoomControlsLabel.textContent = uiMessages.controls;
        if (privateChatEmptyState) privateChatEmptyState.textContent = uiMessages.emptyPrivate;
        if (gameChatSyncLabel) gameChatSyncLabel.textContent = "";
        const newRoomInput = document.getElementById("newRoomInput");
        if (newRoomInput) newRoomInput.placeholder = uiMessages.roomName || uiMessages.roomPlaceholder;
        if (gameGeneralInput) gameGeneralInput.placeholder = uiMessages.generalPlaceholder;
        if (gameCrimesInput) gameCrimesInput.placeholder = uiMessages.crimesPlaceholder;
        if (messageInput) messageInput.placeholder = uiMessages.privatePlaceholder;
        if (document.getElementById("createRoomBtn")) document.getElementById("createRoomBtn").title = uiMessages.create;
        if (document.getElementById("joinRoomBtn")) document.getElementById("joinRoomBtn").textContent = uiMessages.join;
        const cityBtn = document.getElementById("cityShortcutBtn");
        if (cityBtn && !cityBtn.classList.contains("has-alert")) {
          cityBtn.innerHTML = escapeHtml(uiMessages.city || "City") + '<span class="city-shortcut-badge">&#x1F381;</span>';
        }
        updateMailShortcutButton();
        if (gameGeneralSendBtn) gameGeneralSendBtn.textContent = uiMessages.send;
        if (gameCrimesSendBtn) gameCrimesSendBtn.textContent = uiMessages.send;
        if (privateChatSendBtn) privateChatSendBtn.textContent = uiMessages.sendMessage;
        setChatAdminButtonLabel(isChatAdminOpen);
        updateNotesButtonsText();
      }

      function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = String(value);
        return div.innerHTML;
      }

      function setChatAdminButtonLabel(isOpen = false) {
        const btn = document.getElementById("chatAdminToggleBtn");
        if (!btn) return;
        btn.innerHTML = isOpen
          ? "&#x1F6E1;&#xFE0F; " + escapeHtml(uiMessages.admin) + " (Open)"
          : "&#x1F6E1;&#xFE0F; " + escapeHtml(uiMessages.admin);
      }

      function parseTemplateChatMessage(value) {
        const normalized = String(value || "").trim();
        const messageWithoutIcon = normalized.startsWith("🔎") ? normalized.slice(2).trim() : normalized;
        const match = messageWithoutIcon.match(/^(heist|heit|race|oc|moc)\\s+(ariyor|looking for|procura|zoekt)\\s*\\(([^()]*)\\)\\s*$/i);
        if (!match) {
          return null;
        }
        return {
          keyword: normalizeChatTemplateLabel(match[1]),
          verb: match[2],
          location: match[3],
        };
      }

      function isTemplateChatMessage(value) {
        return !!parseTemplateChatMessage(value);
      }

      function renderTemplateChatMessage(templateData) {
        return '<span class="chat-template-icon">🔎</span>' +
          '<span class="chat-keyword">' + escapeHtml(normalizeChatTemplateLabel(templateData.keyword)) + '</span> ' +
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
          return '<span class="ready-dot" title="READY"></span>';
        }

        const timeEnd = Number(value.timeEnd);
        if (!Number.isFinite(timeEnd)) {
          return '<span class="muted">-</span>';
        }

        if (timeEnd <= serverTime) {
          return '<span class="ready-dot" title="READY"></span>';
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
          if (myClientId) {
            result = result.filter((entry) => entry.clientId === myClientId);
          } else if (myPlayerName) {
            result = result.filter((entry) => String(entry.player || "").toLowerCase().trim() === myPlayerName.toLowerCase().trim());
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
        rankFilterSelect.innerHTML = ['<option value="">' + escapeHtml(t("allRanks")) + '</option>'].concat(
          rankFilterOptions.map(([value, label]) => '<option value="' + escapeHtml(value) + '">' + escapeHtml(label) + "</option>")
        ).join("");
      }

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
        updateCityShortcutButton();
        updateActiveCardHighlight();
        if (isGeneralRoom(currentRoom)) {
          lastChatMsgTime = 0;
        }
        if (latestState) {
          renderPlayers(latestState);
        }
        cachedSelfProgression = null;
        loadStateAndChat();
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
        updateNotesButtonsText();

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
        updateCityShortcutButton();
        updateMailShortcutButton();
        updateShortcutReadyBadges(state);

        (function() {
          const gamblingEl = document.getElementById("gamblingLink");
          const statsChip = document.getElementById("playerStatsChip");
          const moneyEl = document.getElementById("playerMoneyValue");
          const bulletsEl = document.getElementById("playerBulletsValue");
          if (gamblingEl) gamblingEl.href = getGamblingPageUrl(activeServerFilter);
          if (statsChip) statsChip.style.display = "flex";
          if (state && state.selfProgression && typeof state.selfProgression === "object") {
            cachedSelfProgression = state.selfProgression;
          } else if (state && state.players && (myClientId || myPlayerName)) {
            const selfEntry = state.players.find(function(p) {
              const srvMatch = (p.serverId || "").toLowerCase() === (activeServerFilter || "").toLowerCase();
              if (myClientId && p.clientId === myClientId) return srvMatch;
              if (myPlayerName) return srvMatch && String(p.player || "").toLowerCase() === myPlayerName.toLowerCase();
              return false;
            });
            if (selfEntry && selfEntry.progression && typeof selfEntry.progression === "object") {
              cachedSelfProgression = selfEntry.progression;
            }
          }
          const prog = cachedSelfProgression || {};
          if (moneyEl) moneyEl.textContent = prog.money || "-";
          if (bulletsEl) bulletsEl.textContent = prog.bullets || "-";
          const bankEl = document.getElementById("playerBankValue");
          const healthEl = document.getElementById("playerHealthValue");
          if (bankEl) bankEl.textContent = prog.bank || "-";
          if (healthEl) healthEl.textContent = prog.health || "-";
          const expFields = [
            ["expPrisonEscape", prog.prisonEscape],
            ["expCrimeAttempts", prog.crimeAttempts],
            ["expCarTheft", prog.carTheftAttempts],
            ["expWonRaces", prog.wonRaces],
            ["expMurders", prog.murders],
            ["expBulletsSpent", prog.bulletsSpent]
          ];
          expFields.forEach(function(pair) {
            const el = document.getElementById(pair[0]);
            if (el) el.textContent = pair[1] || "-";
          });
        })();

        if (myCharacterFilterBtn) {
          myCharacterFilterBtn.textContent = t("character");
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

            const isMyEntry = entry.clientId && myClientId && entry.clientId === myClientId;
            if (currentRoom.toLowerCase() === "general" && !isMyEntry) {
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
            const progressNumeric = Number.parseFloat(String(progressionPercent).replace("%", "").replace(",", "."));
            const progressValue = Number.isFinite(progressNumeric)
              ? Math.max(0, Math.min(100, progressNumeric))
              : null;
            const progressHtml = progressValue === null
              ? '<span class="text-cell">' + escapeHtml(progressionPercent) + "</span>"
              : '<div class="progress-cell"><div class="progress-bar"><div class="progress-bar-fill" style="width: ' + progressValue + '%;"></div></div><span class="progress-value">' + escapeHtml(progressionPercent) + "</span></div>";

            return '<tr class="' + rowClass + '">' +
              '<td title="' + (entry.offline ? "Offline" : "Online") + '">' + status + "</td>" +
              '<td title="' + escapeHtml(entry.player || "-") + '">' + playerNameHtml + "</td>" +
              '<td title="' + escapeHtml(profileTooltip) + '"><span class="text-cell rank-name">' + escapeHtml(rank) + "</span></td>" +
              '<td title="' + escapeHtml(progressionPercent) + '">' + progressHtml + "</td>" +
              '<td title="' + escapeHtml(activityPercent) + '">' + escapeHtml(activityPercent) + "</td>" +
              '<td>' + platingHtml + '</td>' +
              cells +
              '<td title="' + formatUpdated(Number(entry.updatedAt), state.serverTime) + '">' + formatUpdated(Number(entry.updatedAt), state.serverTime) + "</td>" +
              "</tr>";
          });

        const newHtml = rows.join("");
        if (cooldownTableBody.innerHTML !== newHtml) cooldownTableBody.innerHTML = newHtml;
        renderNotesAndTargets(state);
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

          // System notification messages
          if (message.system) {
            if (message.type === 'target-add') {
              const tName = escapeHtml(message.targetName || '');
              const tAdder = escapeHtml(message.addedBy || '');
              let adderSrv = activeServerFilter || 'tr';
              if (latestState && Array.isArray(latestState.players)) {
                const ae = latestState.players.find(function(p) { return p.player === message.addedBy; });
                if (ae && ae.serverId) adderSrv = ae.serverId;
              }
              const tTargetUrl = getPlayerProfileBaseUrl(activeServerFilter || 'tr') + encodeURIComponent(message.targetName || '');
              const tAdderUrl = getPlayerProfileBaseUrl(adderSrv) + encodeURIComponent(message.addedBy || '');
              return '<div class="chat-item system-event" data-msg-id="' + (message.id || '') + '" style="' +
                'display:flex;align-items:center;justify-content:center;gap:6px;' +
                'margin:3px 0;padding:4px 10px;border-radius:7px;' +
                'background:rgba(90,169,255,0.07);border:1px solid rgba(90,169,255,0.20);text-align:center;">' +
                '<span style="font-size:11px;font-weight:400;color:var(--muted);">' +
                '<a href="' + escapeHtml(tAdderUrl) + '" target="_blank" rel="noopener noreferrer" style="color:var(--muted);font-weight:400;text-decoration:none;">' + tAdder + '</a>' +
                ' <span style="color:var(--muted);">' + escapeHtml(t("added")) + '</span> ' +
                '&#x1F3AF; ' +
                '<a href="' + escapeHtml(tTargetUrl) + '" target="_blank" rel="noopener noreferrer" style="color:#5aa9ff;font-weight:700;text-decoration:none;">' + tName + '</a>' +
                ' <span style="color:var(--muted);">' + escapeHtml(t("asTarget")) + '</span>' +
                '</span>' +
                '<span style="font-size:9px;color:var(--muted);flex-shrink:0;">' + escapeHtml(timeStr) + '</span>' +
                '</div>';
            }
            if (message.type === 'target-dead') {
              const tName = escapeHtml(message.targetName || '');
              const tAdder = escapeHtml(message.addedBy || '');
              const tIsDead = !!message.isDead;
              let adderSrv = activeServerFilter || 'tr';
              if (latestState && Array.isArray(latestState.players)) {
                const ae = latestState.players.find(function(p) { return p.player === message.addedBy; });
                if (ae && ae.serverId) adderSrv = ae.serverId;
              }
              const tTargetUrl = getPlayerProfileBaseUrl(activeServerFilter || 'tr') + encodeURIComponent(message.targetName || '');
              const tAdderUrl = getPlayerProfileBaseUrl(adderSrv) + encodeURIComponent(message.addedBy || '');
              const nameColor = tIsDead ? '#c0392b' : '#27ae60';
              const bgColor = tIsDead ? 'rgba(192,57,43,0.08)' : 'rgba(39,174,96,0.08)';
              const borderColor = tIsDead ? 'rgba(192,57,43,0.25)' : 'rgba(39,174,96,0.25)';
              const icon = tIsDead ? '\u2620\ufe0f' : '\u2705';
              const statusLabel = tIsDead ? t('asDead') : t('asAlive');
              return '<div class="chat-item system-event" data-msg-id="' + (message.id || '') + '" style="' +
                'display:flex;align-items:center;justify-content:center;gap:6px;' +
                'margin:3px 0;padding:4px 10px;border-radius:7px;' +
                'background:' + bgColor + ';border:1px solid ' + borderColor + ';text-align:center;">' +
                '<span style="font-size:11px;font-weight:400;color:var(--muted);">' +
                '<a href="' + escapeHtml(tAdderUrl) + '" target="_blank" rel="noopener noreferrer" style="color:var(--muted);font-weight:400;text-decoration:none;">' + tAdder + '</a>' +
                ' <span style="color:var(--muted);">' + escapeHtml(t("marked")) + '</span> ' +
                icon + ' ' +
                '<a href="' + escapeHtml(tTargetUrl) + '" target="_blank" rel="noopener noreferrer" style="color:' + nameColor + ';font-weight:700;text-decoration:none;">' + tName + '</a>' +
                ' <span style="color:var(--muted);">' + statusLabel + '</span>' +
                '</span>' +
                '<span style="font-size:9px;color:var(--muted);flex-shrink:0;">' + escapeHtml(timeStr) + '</span>' +
                '</div>';
            }
            const isDead = String(message.message || '').includes('DEAD');
            const sysBg = isDead ? 'rgba(255,107,107,0.10)' : 'rgba(51,209,122,0.10)';
            const sysBorder = isDead ? 'rgba(255,107,107,0.35)' : 'rgba(51,209,122,0.35)';
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
          const nickColor = isOwn ? "#98c379" : "#5aa9ff";

          const srvBadgeColor = { tr: '#e06c75', com: '#61afef', nl: '#e5c07b', pt: '#98c379' };
          const srvColor = srvBadgeColor[playerServerId] || 'var(--muted)';
          const serverBadge = '<span style="font-size:8px;font-weight:800;color:' + srvColor + ';opacity:0.85;flex-shrink:0;letter-spacing:0.3px;">' + escapeHtml(playerServerId.toUpperCase()) + '</span>';

          const pinText = message.pinned ? "📍" : "📌";
          const pinBtn = '<button type="button" class="chat-pin-button" data-msg-id="' + (message.id || "") + '" title="' + (message.pinned ? "Unpin" : "Pin") + '">' + pinText + '</button>';
          const replyBtn = isOwn ? "" : '<button type="button" class="chat-reply-button" data-player="' + playerName + '" title="Reply">↩</button>';

          return '<div class="chat-item ' + bubbleClass + '" data-msg-id="' + (message.id || "") + '">' +
            '<span class="chat-time">[' + escapeHtml(timeStr) + ']</span>' +
            serverBadge +
            '<a class="chat-player" href="' + escapeHtml(playerProfileUrl) + '" target="_blank" rel="noopener noreferrer" style="color:' + nickColor + ';">' + playerName + '</a>' +
            '<span class="chat-text"> ' + msgText + '</span>' +
            ' ' + pinBtn +
            (replyBtn ? ' ' + replyBtn : '') +
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

      function formatGameChatTime(createdAt) {
        const s = String(createdAt || "");
        const spaceIdx = s.indexOf(" ");
        if (spaceIdx === -1) return s.slice(0, 5);
        const t = s.slice(spaceIdx + 1);
        return t.length >= 5 ? t.slice(0, 5) : t;
      }

      function parseGiftMessage(s) {
        var clean = s.replace(/<[^>]*>/g, "").trim();
        var playerName = "";
        var m1 = clean.match(/^(.+?)[ \t]+found[ \t]+a[ \t]+gift/i);
        if (m1) playerName = m1[1].trim();
        if (!playerName) {
          var m2 = clean.match(/^(.+?)[ \t]+found[ \t]/i);
          if (m2) playerName = m2[1].trim();
        }
        if (!playerName) {
          var m3 = s.match(/user[.]php[?](?:[^"']*&)?name=([^"'& \t]+)/i);
          if (m3) playerName = decodeURIComponent(m3[1]);
        }
        if (!playerName) {
          var m4 = clean.match(/^([^ \t]+)/);
          if (m4) playerName = m4[1];
        }
        var moneyMatch = clean.match(/[$]([0-9,]+)/);
        var money = moneyMatch ? moneyMatch[1] : "";
        var bulletsMatch = clean.match(/ and ([0-9,]+)/i);
        var bullets = bulletsMatch ? bulletsMatch[1] : "";
        var car = "";
        var colonIdx = clean.indexOf(":");
        var dollarIdx = clean.indexOf("$");
        if (colonIdx !== -1 && dollarIdx > colonIdx) {
          var carSection = clean.slice(colonIdx + 1, dollarIdx);
          var carMatch = carSection.match(/([0-9][0-9,]*)/);
          if (carMatch) car = carMatch[1];
        }
        return { playerName: playerName, car: car, money: money, bullets: bullets, clean: clean };
      }

      function parseDeathMessage(s) {
        var plain = s.replace(/<[^>]*>/g, "").replace(/✝[ \t]*/g, "").trim();
        var parts = plain.split(/[ \t]*-[ \t]*/);
        var namePart = parts[0] ? parts[0].trim() : "";
        var family = parts[1] ? parts[1].trim() : "";
        var playerName = namePart;
        var rank = "";
        var rankMatch = namePart.match(/^(.+?)[ \t]*[(]([^)]+)[)][ \t]*$/);
        if (rankMatch) {
          playerName = rankMatch[1].trim();
          rank = rankMatch[2].trim();
        }
        return { playerName: playerName, rank: rank, family: family };
      }

      function renderGameChat(kind, messages) {
        const container = kind === "crimes" ? gameCrimesMessages : gameGeneralMessages;
        const caption = kind === "crimes" ? gameCrimesCaption : gameGeneralCaption;
        if (!container || !caption) return;

        const trackerKey = kind === "crimes" ? "crimes" : "general";
        const seenIds = gameChatSeenIds[trackerKey];
        const currentSender = getChatSender();
        let hasNewMessage = false;

        const newMessages = (messages || []).filter(function(msg) {
          return msg && msg.id != null && !seenIds.has(String(msg.id));
        });

        caption.textContent = getGameChatRoomLabel(kind);

        if (newMessages.length === 0) return;

        const placeholder = container.querySelector(".chat-empty");
        if (placeholder) placeholder.remove();

        const isAtBottom = container.scrollHeight - container.clientHeight - container.scrollTop <= 20;
        const profileBase = getPlayerProfileBaseUrl(lastGameChatServerId || activeServerFilter || "tr");

        for (var i = 0; i < newMessages.length; i++) {
          const msg = newMessages[i];
          seenIds.add(String(msg.id));

          const msgText = String(msg.message || "");
          const isGift = msgText.includes("found a gift") || msgText.includes("fa-gift");
          const isDeath = msgText.includes("✝") || msgText.includes("fa-cross");
          const timeStr = formatGameChatTime(msg.created_at);

          const el = document.createElement("div");
          el.style.cssText = "font-size:11px;line-height:1.5;padding:1px 0;word-break:break-word;";

          var tSpan = document.createElement("span");
          tSpan.style.color = "#7f8794";
          tSpan.style.fontSize = "9px";
          tSpan.textContent = "[" + timeStr + "] ";

          if (isGift) {
            var gp = parseGiftMessage(msgText);
            var giftName = gp.playerName || String(msg.user_name || "?");
            el.style.color = "#f6c453";
            el.style.fontStyle = "italic";
            tSpan.style.color = "#f6c453";
            el.appendChild(tSpan);
            el.appendChild(document.createTextNode("🎁 "));
            var gNameSpan = document.createElement("span");
            gNameSpan.style.fontWeight = "700";
            gNameSpan.textContent = giftName;
            el.appendChild(gNameSpan);
            el.appendChild(document.createTextNode(" found a gift"));
            if (gp.car) {
              el.appendChild(document.createTextNode(" 🚗 "));
              var carI = document.createElement("i"); carI.textContent = "x" + gp.car; el.appendChild(carI);
            }
            if (gp.money) {
              el.appendChild(document.createTextNode("  💵 "));
              var monI = document.createElement("i"); monI.textContent = gp.money; el.appendChild(monI);
            }
            if (gp.bullets) {
              el.appendChild(document.createTextNode(" and 💥 "));
              var bulI = document.createElement("i"); bulI.textContent = gp.bullets; el.appendChild(bulI);
              el.appendChild(document.createTextNode(" bullet"));
            }
            if (!gp.car && !gp.money && !gp.bullets) {
              el.appendChild(document.createTextNode(" " + gp.clean));
            }

          } else if (isDeath) {
            var dp = parseDeathMessage(msgText);
            el.style.color = "#e05c5c";
            el.appendChild(tSpan);
            tSpan.style.color = "#c4535a";
            el.appendChild(document.createTextNode("💀 "));
            if (dp.playerName) {
              var dLink = document.createElement("a");
              dLink.href = profileBase + encodeURIComponent(dp.playerName);
              dLink.target = "_blank";
              dLink.rel = "noopener noreferrer";
              dLink.style.color = "#e05c5c";
              dLink.style.fontWeight = "700";
              dLink.style.textDecoration = "none";
              dLink.style.cursor = "pointer";
              dLink.textContent = dp.playerName;
              el.appendChild(dLink);
            }
            if (dp.rank) el.appendChild(document.createTextNode(" (" + dp.rank + ")"));
            if (dp.family) el.appendChild(document.createTextNode(" | " + dp.family));

          } else {
            el.appendChild(tSpan);
            var nLink = document.createElement("a");
            nLink.href = profileBase + encodeURIComponent(String(msg.user_name || ""));
            nLink.target = "_blank";
            nLink.rel = "noopener noreferrer";
            nLink.style.color = "#5aa9ff";
            nLink.style.fontWeight = "700";
            nLink.style.textDecoration = "none";
            nLink.style.cursor = "pointer";
            nLink.textContent = String(msg.user_name || "-");
            el.appendChild(nLink);
            el.appendChild(document.createTextNode(" " + msgText));
          }

          container.appendChild(el);

          if (String(msg.user_name || "") !== currentSender) {
            hasNewMessage = true;
          }
        }

        if (isAtBottom) {
          container.scrollTop = container.scrollHeight;
        }

        if (hasNewMessage && isChatSoundEnabled && (document.hidden || !document.hasFocus())) {
          playNotificationSound();
        }
      }

      async function loadStateAndChat() {
        if (!currentRoom) {
          roomTitle.textContent = FIXED_ROOM;
          chatPanelTitle.textContent = getChatRoomLabel(FIXED_ROOM);
          if (stateMeta) stateMeta.textContent = "";
          chatMeta.textContent = t("noMessagesLoaded");
          cooldownTableBody.innerHTML = '<tr><td colspan="20" class="muted">No room selected.</td></tr>';
          chatMessages.innerHTML = '<div class="chat-empty">' + escapeHtml(t("selectRoomToChat")) + '</div>';
          return;
        }

        if (!isValidRoom(currentRoom)) {
          roomTitle.textContent = currentRoom;
          chatPanelTitle.textContent = getChatRoomLabel(currentRoom);
          if (stateMeta) stateMeta.textContent = "";
          cooldownTableBody.innerHTML = '<tr><td colspan="20" class="muted">Invalid room name.</td></tr>';
          chatMessages.innerHTML = '<div class="chat-empty">Invalid room name.</div>';
          return;
        }

        try {
          const statusRes = await fetch("/api/rooms/status?room=" + encodeURIComponent(currentRoom) + "&clientId=" + encodeURIComponent(myClientId));
          const statusData = await statusRes.json();
          userRoomStatus = statusData.status || "none";

          // Auto-join: if status is none and we have a player name, try request-join
          // Server will approve immediately if player name matches room owner
          if (userRoomStatus === "none" && myClientId && myPlayerName) {
            const autoRes = await fetch("/api/rooms/request-join", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ room: currentRoom, clientId: myClientId, player: myPlayerName })
            });
            const autoData = await autoRes.json();
            if (autoRes.ok && autoData.ok && (autoData.role === "owner" || autoData.role === "member")) {
              userRoomStatus = autoData.role;
            } else if (autoRes.ok && autoData.ok) {
              userRoomStatus = autoData.role || "pending";
            }
          }

          const layoutEl = document.querySelector(".layout");
          const unauthorizedEl = document.getElementById("unauthorizedView");
          const cooldownsPanel = document.getElementById("cooldownsPanel");
          const obayPanel = document.getElementById("obayPanel");
          const chatPanel = document.getElementById("chatPanel");
          const chatAdminPanel = document.getElementById("chatAdminPanel");

          if (userRoomStatus === "owner" || userRoomStatus === "member") {
            layoutEl.style.display = "grid";
            layoutEl.style.gridTemplateColumns = "1fr";
            unauthorizedEl.style.display = "none";
            cooldownsPanel.style.display = "block";
            if (obayPanel) obayPanel.style.display = "block";
            chatPanel.style.display = "flex";
            const gameChatsPanel = document.getElementById("gameChatsPanel");
            if (gameChatsPanel) gameChatsPanel.style.display = "flex";

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

            const stateResponse = await fetch("/api/state?room=" + encodeURIComponent(currentRoom) + "&clientId=" + encodeURIComponent(myClientId) + "&serverId=" + encodeURIComponent(activeServerFilter || ""));
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
            if (stateMeta) stateMeta.textContent = "";

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

            renderPlayers(stateData);
            const activeSrv = getActiveChatServerId();
            if (activeSrv !== lastGameChatServerId) {
              lastGameChatServerId = activeSrv;
              gameChatSeenIds.general.clear();
              gameChatSeenIds.crimes.clear();
              if (gameGeneralMessages) gameGeneralMessages.innerHTML = '<div class="chat-empty">' + escapeHtml(t("loadingGeneralChat")) + '</div>';
              if (gameCrimesMessages) gameCrimesMessages.innerHTML = '<div class="chat-empty">' + escapeHtml(t("loadingCrimesChat")) + '</div>';
            }

            try {
              const generalChatRes = await fetch("/api/game-chat?serverId=" + encodeURIComponent(activeSrv) + "&kind=general");
              if (generalChatRes.ok) {
                const generalChatData = await generalChatRes.json();
                if (generalChatData.serverTime && generalChatData.serverTimeSyncedAt) {
                  gameChatServerTimeBase = { serverTime: generalChatData.serverTime, serverTimeSyncedAt: generalChatData.serverTimeSyncedAt, serverId: activeSrv };
                  if (!gameChatClockInterval) {
                    gameChatClockInterval = setInterval(function() {
                      if (gameChatServerMeta && gameChatServerTimeBase) {
                        gameChatServerMeta.textContent = computeServerClock(gameChatServerTimeBase.serverTime, gameChatServerTimeBase.serverTimeSyncedAt);
                      }
                    }, 1000);
                  }
                }
                renderGameChat("general", generalChatData.messages || []);
              }
            } catch (_gcE) {}

            try {
              const crimesChatRes = await fetch("/api/game-chat?serverId=" + encodeURIComponent(activeSrv) + "&kind=crimes");
              if (crimesChatRes.ok) {
                const crimesChatData = await crimesChatRes.json();
                renderGameChat("crimes", crimesChatData.messages || []);
              }
            } catch (_gcE) {}

            chatPanelTitle.textContent = isGeneralRoom(currentRoom) ? "Portal General" : currentRoom;
            if (isGeneralRoom(currentRoom)) {
              chatMeta.textContent = t("portalGeneralControlsOnly");
              chatMessages.innerHTML = '<div class="chat-empty">' + escapeHtml(t("noPrivateChatPanel")) + '</div>';
              setPrivateChatIdleState(true);
            } else {
              const chatRoomKey = getChatRoomKey(currentRoom);
              const chatRoomLabel = getChatRoomLabel(currentRoom);
              const chatResponse = await fetch("/api/chat?room=" + encodeURIComponent(chatRoomKey) + "&clientId=" + encodeURIComponent(myClientId));
              const chatData = await chatResponse.json();
              if (!chatResponse.ok) {
                throw new Error(chatData.error || "Chat request failed");
              }
              setPrivateChatIdleState(false);
              renderChat(chatRoomLabel, chatData.messages);
            }
          } else {
            layoutEl.style.display = "grid";
            layoutEl.style.gridTemplateColumns = "1fr";
            unauthorizedEl.style.display = "block";
            cooldownsPanel.style.display = "none";
            if (obayPanel) obayPanel.style.display = "none";
            chatPanel.style.display = "none";
            const gameChatsPanel = document.getElementById("gameChatsPanel");
            if (gameChatsPanel) gameChatsPanel.style.display = "none";
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
          chatPanelTitle.textContent = isGeneralRoom(currentRoom || FIXED_ROOM) ? "Portal General" : getChatRoomLabel(currentRoom || FIXED_ROOM);
          if (stateMeta) stateMeta.textContent = "";
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

        loadStateAndChat();
        pollTimer = window.setInterval(loadStateAndChat, 1000);
      }

      function applyRoom(room) {
        currentRoom = (room || FIXED_ROOM).trim();
        roomInput.value = currentRoom;
        setRoomInUrl(currentRoom);
        shouldAutoSelectServer = true;
        lastChatMsgTime = 0;
        updateChatFormState();
        startPolling();
      }

      roomInput.value = FIXED_ROOM;
      roomInput.readOnly = true;
      applyRoomButton.disabled = true;
      applyRoomButton.textContent = "Locked";
      applyLocaleTexts();
      applyLanguage();
      populateRankFilterOptions();
      applyLanguage();
      updateRankSortButton();
      updateSoundButtonState();
      const initialSoundBtn = document.getElementById("chatSoundToggleBtn");
      if (initialSoundBtn) initialSoundBtn.textContent = isChatSoundEnabled ? uiMessages.soundOn : uiMessages.soundOff;

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
          if (stateMeta) stateMeta.textContent = "";
          window.postMessage({ type: "OMERTA_CONNECT_ALL" }, "*");
          window.setTimeout(() => {
            if (dashboardConnectBtn) {
              dashboardConnectBtn.disabled = false;
            }
          }, 2500);
        });
      }


      const cityShortcutBtn = document.getElementById("cityShortcutBtn");
      if (cityShortcutBtn) {
        cityShortcutBtn.addEventListener("click", () => {
          window.open(getCityPageUrl(getActiveChatServerId()), "_blank");
        });
      }

      const headerMailBtn = document.getElementById("headerMailBtn");
      if (headerMailBtn) {
        headerMailBtn.addEventListener("click", () => {
          window.open(getMailPageUrl(getActiveChatServerId()), "_blank");
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
        const soundBtn = document.getElementById("chatSoundToggleBtn");
        if (soundBtn) soundBtn.textContent = isChatSoundEnabled ? uiMessages.soundOn : uiMessages.soundOff;
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

      chatForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        setConnectionIndicator(chatFeedback, isConnected && myPlayerName ? "online" : "offline", myPlayerName ? "Connected as " + myPlayerName : "Not connected");

        let message = messageInput.value.trim();
        message = message.replace(/\s*\(\)/g, "").trim();

        if (!isConnected || !myPlayerName) {
          setConnectionIndicator(chatFeedback, "error", "Open Omerta and wait for extension to connect.");
          return;
        }

        if (!message) {
          setConnectionIndicator(chatFeedback, "error", "Message cannot be empty.");
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
          updateChatFormState();
          loadStateAndChat();
        } catch (error) {
          setConnectionIndicator(chatFeedback, "error", error.message || "Message send failed");
        }
      });

      if (gameGeneralForm) {
        gameGeneralForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          await sendGameChatMessage("general", gameGeneralInput, gameGeneralFeedback);
        });
      }

      if (gameCrimesForm) {
        gameCrimesForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          await sendGameChatMessage("crimes", gameCrimesInput, gameCrimesFeedback);
        });
      }

      if (gameGeneralInput) {
        gameGeneralInput.addEventListener("keydown", function(e) {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (gameGeneralForm) gameGeneralForm.requestSubmit();
          }
        });
      }

      if (gameCrimesInput) {
        gameCrimesInput.addEventListener("keydown", function(e) {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (gameCrimesForm) gameCrimesForm.requestSubmit();
          }
        });
      }

      function getChatSender() {
        return myPlayerName || "";
      }

      async function sendGameChatMessage(kind, inputEl, feedbackEl) {
        if (!inputEl || !feedbackEl) return;
        setConnectionIndicator(feedbackEl, isConnected && myPlayerName ? "online" : "offline", myPlayerName ? "Connected as " + myPlayerName : "Not connected");
        let message = inputEl.value.trim();
        message = message.replace(/\s*\(\)/g, "").trim();
        if (!isConnected || !myPlayerName) {
          setConnectionIndicator(feedbackEl, "error", "Open Omerta and wait for extension to connect.");
          return;
        }
        if (!message) {
          setConnectionIndicator(feedbackEl, "error", "Message cannot be empty.");
          return;
        }
        try {
          const response = await fetch("/api/game-chat-outbox", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ serverId: getActiveChatServerId(), kind, message })
          });
          const resData = await response.json().catch(() => ({ ok: false, error: "Invalid response" }));
          if (!response.ok || !resData.ok) {
            throw new Error(resData.error || "Message send failed");
          }
          inputEl.value = "";
          setConnectionIndicator(feedbackEl, "online", "Sending...");
        } catch (error) {
          setConnectionIndicator(feedbackEl, "error", error.message || "Message send failed");
        }
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

      function normalizeChatTemplateLabel(label) {
        const normalizedLabel = String(label || "").trim().toLowerCase();
        if (normalizedLabel === "heist" || normalizedLabel === "heit") return "Heist";
        if (normalizedLabel === "race") return "Race";
        if (normalizedLabel === "oc") return "OC";
        if (normalizedLabel === "moc") return "MOC";
        return String(label || "").trim() || "Heist";
      }

      function getChatTemplateText(serverId, label) {
        const normalizedServerId = String(serverId || "").trim().toLowerCase();
        const safeLabel = normalizeChatTemplateLabel(label);
        if (normalizedServerId === "com") {
          return "🔎 " + safeLabel + " Looking for ()";
        }
        if (normalizedServerId === "pt") {
          return "🔎 " + safeLabel + " Procura ()";
        }
        if (normalizedServerId === "nl") {
          return "🔎 " + safeLabel + " Zoekt ()";
        }
        return "🔎 " + safeLabel + " Arıyor ()";
      }

      function parseTemplateChatMessage(value) {
        const normalized = String(value || "").trim();
        const messageWithoutIcon = normalized.replace(/^🔎\s*/u, "").replace(/^ğŸ”\s*/, "").trim();
        const match = messageWithoutIcon.match(/^(heist|race|oc|moc)\s+(arıyor|ariyor|looking for|procura|zoekt)\s*\(([^()]*)\)\s*$/iu);
        if (!match) {
          return null;
        }
        return {
          keyword: normalizeChatTemplateLabel(match[1]),
          verb: match[2],
          location: match[3],
        };
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

      function normalizeChatTemplateLabel(label) {
        const normalizedLabel = String(label || "").trim().toLowerCase();
        if (normalizedLabel === "heist" || normalizedLabel === "heit") return "Heist";
        if (normalizedLabel === "race") return "Race";
        if (normalizedLabel === "oc") return "OC";
        if (normalizedLabel === "moc") return "MOC";
        return String(label || "").trim() || "Heist";
      }

      function getChatTemplateText(serverId, label) {
        const normalizedServerId = String(serverId || "").trim().toLowerCase();
        const safeLabel = normalizeChatTemplateLabel(label);
        const icon = "\uD83D\uDD0E";
        if (normalizedServerId === "com") {
          return icon + " " + safeLabel + " Looking for ()";
        }
        if (normalizedServerId === "pt") {
          return icon + " " + safeLabel + " Procura ()";
        }
        if (normalizedServerId === "nl") {
          return icon + " " + safeLabel + " Zoekt ()";
        }
        return icon + " " + safeLabel + " Ar\u0131yor ()";
      }

      function parseTemplateChatMessage(value) {
        const normalized = String(value || "").trim();
        const messageWithoutIcon = normalized
          .replace(/^\u{1F50E}\s*/u, "")
          .replace(/^ğŸ”\s*/u, "")
          .replace(/^ÄŸÅ¸â€Â\s*/u, "")
          .trim();
        const match = messageWithoutIcon.match(/^(heist|heit|race|oc|moc)\s+(ar\u0131yor|ariyor|arÄ±yor|search|looking for|procura|zoekt)\s*\(([^()]*)\)\s*$/iu);
        if (!match) {
          return null;
        }
        return {
          keyword: normalizeChatTemplateLabel(match[1]),
          verb: match[2],
          location: match[3],
        };
      }

      function clearActiveTemplateState() {
        activeTemplateState = null;
        document.querySelectorAll(".chat-shortcut[data-template]").forEach(function(btn) {
          btn.classList.remove("active-template");
        });
      }

      function normalizeLegacyTemplateText(value) {
        return String(value || "")
          .replace(/\bHeit\b/giu, "Heist")
          .replace(/\bAriyor\b/giu, "Ar\u0131yor");
      }

      function renderChatMessageText(value) {
        const templateData = parseTemplateChatMessage(value);
        if (templateData) {
          return renderTemplateChatMessage(templateData);
        }
        return escapeHtml(value);
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
        if (activeTemplateState && activeTemplateState.label === label) {
          clearActiveTemplateState();
          messageInput.value = "";
          updateChatFormState();
          return;
        }
        const template = buildChatTemplate(label);
        activeTemplateState = createTemplateState(template);
        if (activeTemplateState) activeTemplateState.label = label;
        document.querySelectorAll(".chat-shortcut[data-template]").forEach(function(btn) {
          btn.classList.toggle("active-template", btn.dataset.template === label);
        });
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
        const canUsePrivateChat = isConnected && myPlayerName;
        if (canUsePrivateChat) {
          messageInput.disabled = false;
          if (sendBtn) sendBtn.disabled = false;
          if (emojiBtn) emojiBtn.disabled = false;
          shortcutButtons.forEach((button) => { button.disabled = false; });
          setConnectionIndicator(chatFeedback, "online", "Connected as " + myPlayerName);
        } else {
          messageInput.disabled = true;
          if (sendBtn) sendBtn.disabled = true;
          if (emojiBtn) emojiBtn.disabled = true;
          shortcutButtons.forEach((button) => { button.disabled = true; });
          setConnectionIndicator(chatFeedback, "error", "Open Omerta and wait for extension to connect.");
        }

        const canUseGameChat = isConnected && myPlayerName;
        if (gameGeneralInput) gameGeneralInput.disabled = !canUseGameChat;
        if (gameCrimesInput) gameCrimesInput.disabled = !canUseGameChat;
        if (gameGeneralSendBtn) gameGeneralSendBtn.disabled = !canUseGameChat;
        if (gameCrimesSendBtn) gameCrimesSendBtn.disabled = !canUseGameChat;
        if (gameGeneralFeedback) {
          setConnectionIndicator(gameGeneralFeedback, canUseGameChat ? "online" : "offline", canUseGameChat ? "Connected as " + myPlayerName : "Not connected");
        }
        if (gameCrimesFeedback) {
          setConnectionIndicator(gameCrimesFeedback, canUseGameChat ? "online" : "offline", canUseGameChat ? "Connected as " + myPlayerName : "Not connected");
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
          
          if (data.clientId && !myClientId) {
            myClientId = data.clientId;
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
              // Re-check room access when clientId becomes available
              if (myClientId && myClientId !== oldClientId) {
                loadStateAndChat();
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
          if (!data.ok) {
            if (stateMeta) stateMeta.textContent = "";
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

      // Auto-connect: retry a few times so tabs that are slow to initialize also get picked up
      [800, 4000, 10000].forEach(function(delay) {
        window.setTimeout(function() {
          window.postMessage({ type: "OMERTA_SEND_NOW_ALL" }, "*");
        }, delay);
      });

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
            // Auto-close the targets panel after successfully adding
            const notesPanel = document.getElementById('notesPanel');
            if (notesPanel && notesPanel.style.display !== 'none') {
              notesPanel.style.display = 'none';
              activeNotesTab = null;
              const hTBtn = document.getElementById('headerTargetsBtn');
              const hNBtn = document.getElementById('headerNotesBtn');
              if (hTBtn) { hTBtn.style.borderColor = 'var(--border)'; hTBtn.style.color = 'var(--muted)'; }
              if (hNBtn) { hNBtn.style.borderColor = 'var(--border)'; hNBtn.style.color = 'var(--muted)'; }
            }
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
      const roomTabsSelect = document.getElementById("roomTabsContainer");
      if (roomTabsSelect) {
        roomTabsSelect.addEventListener("change", (event) => {
          const nextRoom = String(event.target.value || "").trim();
          if (nextRoom) {
            selectRoom(nextRoom);
          }
        });
      }
      applyRoom(activeRoom);

    </script>

  <div id="expPanel" style="display:none; position:fixed; width:280px; background:#161b24; border:1px solid var(--border); border-top:2px solid var(--accent); border-radius:10px; box-shadow:0 8px 28px rgba(0,0,0,0.75); z-index:99999; font-size:12px;">
    <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px 8px; border-bottom:1px solid var(--border);">
      <span style="font-weight:700; color:var(--accent);">Hesap Tecrübeleri</span>
      <button id="expPanelClose" type="button" style="background:none;border:none;color:var(--muted);font-size:16px;cursor:pointer;line-height:1;padding:0 2px;">✕</button>
    </div>
    <div style="padding:8px 12px;">
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="color:var(--muted);">Hapisten Kaçırma</span><span id="expPrisonEscape" style="font-weight:600;">-</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="color:var(--muted);">Suç Girişimleri</span><span id="expCrimeAttempts" style="font-weight:600;">-</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="color:var(--muted);">Araba Çalma</span><span id="expCarTheft" style="font-weight:600;">-</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="color:var(--muted);">Yarış Kazanma</span><span id="expWonRaces" style="font-weight:600;">-</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="color:var(--muted);">Cinayetler</span><span id="expMurders" style="font-weight:600;">-</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;"><span style="color:var(--muted);">Geri Saldırı Mermi</span><span id="expBulletsSpent" style="font-weight:600;">-</span></div>
    </div>
  </div>

  <!-- Obay compact panel -->
  <div id="obayCompactPanel" style="display:none; position:fixed; width:600px; background:#161b24; border:1px solid var(--border); border-top:2px solid var(--accent); border-radius:10px; box-shadow:0 8px 28px rgba(0,0,0,0.75); z-index:99999; font-size:12px;">
    <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px 8px; border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:8px;">
        <img src="https://barafranca.com/static/images/game/generic/obay.gif" style="width:18px;height:18px;object-fit:contain;">
        <span style="font-weight:700; color:var(--accent);">Obay Açık Artırma</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span id="obayCompactMeta" style="color:var(--muted);font-size:10px;"></span>
        <button id="obayCompactClose" type="button" style="background:none;border:none;color:var(--muted);font-size:16px;cursor:pointer;line-height:1;padding:0 2px;">✕</button>
      </div>
    </div>
    <div style="padding:6px 12px 4px; border-bottom:1px solid var(--border); display:flex; flex-wrap:wrap; gap:6px 14px;">
      <label style="display:flex;align-items:center;gap:4px;cursor:pointer;color:var(--muted);font-size:11px;"><input type="checkbox" class="obay-filter" data-key="car" style="accent-color:var(--accent);"> Car</label>
      <label style="display:flex;align-items:center;gap:4px;cursor:pointer;color:var(--muted);font-size:11px;"><input type="checkbox" class="obay-filter" data-key="donate" style="accent-color:var(--accent);"> Donate code</label>
      <label style="display:flex;align-items:center;gap:4px;cursor:pointer;color:var(--muted);font-size:11px;"><input type="checkbox" class="obay-filter" data-key="witness" style="accent-color:var(--accent);"> Witness statements</label>
      <label style="display:flex;align-items:center;gap:4px;cursor:pointer;color:var(--muted);font-size:11px;"><input type="checkbox" class="obay-filter" data-key="bullets" style="accent-color:var(--accent);"> Pack of bullets</label>
      <label style="display:flex;align-items:center;gap:4px;cursor:pointer;color:var(--muted);font-size:11px;"><input type="checkbox" class="obay-filter" data-key="bodyguard" style="accent-color:var(--accent);"> Bodyguard</label>
      <label style="display:flex;align-items:center;gap:4px;cursor:pointer;color:var(--muted);font-size:11px;"><input type="checkbox" class="obay-filter" data-key="casino" style="accent-color:var(--accent);"> Casino</label>
      <label style="display:flex;align-items:center;gap:4px;cursor:pointer;color:var(--muted);font-size:11px;"><input type="checkbox" class="obay-filter" data-key="accommodation" style="accent-color:var(--accent);"> Accommodation</label>
    </div>
    <div style="padding:0 0 6px; max-height:360px; overflow-y:auto;">
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
        <colgroup>
          <col style="width:28%">
          <col style="width:14%">
          <col style="width:17%">
          <col style="width:17%">
          <col style="width:12%">
          <col style="width:12%">
        </colgroup>
        <thead>
          <tr style="color:var(--muted);text-align:left;font-size:10px;border-bottom:1px solid var(--border);position:sticky;top:0;background:#161b24;z-index:2;">
            <th data-sort="name" style="padding:6px 8px 4px 0;font-weight:600;cursor:pointer;user-select:none;">İsim <span id="obaySort_name"></span></th>
            <th style="padding:6px 8px 4px;font-weight:600;">Satıcı</th>
            <th data-sort="bid" style="padding:6px 8px 4px;font-weight:600;cursor:pointer;user-select:none;">Min. Teklif <span id="obaySort_bid"></span></th>
            <th style="padding:6px 8px 4px;font-weight:600;">Şimdi Al</th>
            <th style="padding:6px 8px 4px;font-weight:600;">Teklif Veren</th>
            <th data-sort="end" style="padding:6px 0 4px 8px;font-weight:600;cursor:pointer;user-select:none;">Bitiş <span id="obaySort_end"></span></th>
          </tr>
        </thead>
        <tbody id="obayCompactBody">
          <tr><td colspan="6" style="color:var(--muted);padding:10px 0;text-align:center;">Veri bekleniyor...</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <script>
    (function() {
      // Exp panel
      var btn = document.getElementById("expToggleBtn");
      var panel = document.getElementById("expPanel");
      var closeBtn = document.getElementById("expPanelClose");
      if (btn && panel) {
        function openExpPanel() {
          var r = btn.getBoundingClientRect();
          panel.style.top = (r.bottom + 6) + "px";
          panel.style.right = (window.innerWidth - r.right) + "px";
          panel.style.display = "block";
        }
        function closeExpPanel() { panel.style.display = "none"; }
        btn.addEventListener("click", function(e) {
          e.stopPropagation();
          panel.style.display === "none" ? openExpPanel() : closeExpPanel();
        });
        closeBtn && closeBtn.addEventListener("click", closeExpPanel);
        document.addEventListener("click", function(e) {
          if (panel.style.display !== "none" && !panel.contains(e.target) && e.target !== btn) closeExpPanel();
        });
      }

      // Obay compact panel
      var obayBtn = document.getElementById("obayCompactBtn");
      var obayPanel = document.getElementById("obayCompactPanel");
      var obayClose = document.getElementById("obayCompactClose");
      var obayBody = document.getElementById("obayCompactBody");
      var obayMeta = document.getElementById("obayCompactMeta");
      var _obayAllItems = [];

      var OBAY_FILTER_KEYWORDS = {
        car:           ["car", "auto", "wagen", "vehicle", "suv", "truck", "sedan", "bugatti", "ferrari", "lamborghini", "porsche", "mercedes", "bmw"],
        donate:        ["donate", "donating", "donatecode", "donate code", "donatiecode", "donation"],
        witness:       ["witness", "verklaring", "getuige", "statement"],
        bullets:       ["bullet", "bullets", "kogels", "pak met kogels", "pack of bullets", "ammo", "ammunition"],
        bodyguard:     ["bodyguard", "bewaker"],
        casino:        ["casino", "chip", "casinotoken"],
        accommodation: ["accommodation", "woning", "huis", "onderkomen", "accommod", "apartment", "house"]
      };

      // Bodyguard items use "Name (Type | Skills)" format, e.g. "Joe (D10 | G+V)"
      var BODYGUARD_PATTERN = /\\([A-Z]\\d+\\s*\\|/;

      function matchesObayFilter(name, key) {
        var n = String(name || "").toLowerCase();
        if (key === "bodyguard" && BODYGUARD_PATTERN.test(String(name || ""))) return true;
        return (OBAY_FILTER_KEYWORDS[key] || []).some(function(kw) { return n.includes(kw); });
      }

      function getActiveObayFilters() {
        return Array.from(document.querySelectorAll(".obay-filter:checked")).map(function(el) { return el.dataset.key; });
      }

      function formatObayName(name) {
        var n = String(name || "");
        if (!n) return "-";
        
        var isBodyguard = /^bodyguard:\\s*/i.test(n) || /\\([ADS]\\d+/.test(n);
        var cleanName = n.replace(/^bodyguard:\\s*/i, "");
        var lower = n.toLowerCase();
        
        if (isBodyguard) {
          return '<span style="color:var(--accent);font-weight:600;">' + cleanName + '</span>';
        }
        if (lower.includes("bullet") || lower.includes("kogel") || lower.includes("mermi")) {
          return '<span style="color:var(--red);font-weight:600;">' + cleanName + '</span>';
        }
        if (lower.includes("donate") || lower.includes("donatie") || lower.includes("kod") || lower.includes("gift")) {
          return '<span style="color:var(--yellow);font-weight:600;">' + cleanName + '</span>';
        }
        if (lower.includes("car") || lower.includes("auto") || lower.includes("wagen")) {
          return '<span style="color:#f43f5e;font-weight:600;">' + cleanName + '</span>';
        }
        return '<span style="font-weight:600;">' + cleanName + '</span>';
      }

      var _obaySort = { key: null, dir: 1 };
      var _obayCurrentLink = "";

      function parseBid(str) {
        return parseFloat(String(str || "").replace(/[^0-9.]/g, "")) || 0;
      }

      // Time duration parsing helper for countdowns
      function parseEndSeconds(str) {
        var s = String(str || "").trim().toLowerCase();
        if (!s || s === "now") return 0;
        var total = 0;
        // "g" present → Turkish day format: g=gün(days), s=saat(hours), d=dakika(minutes)
        var hasTurkishDays = /\\d\\s*g\\b/.test(s);
        var re = /(\\d+)\\s*(sa|dk|sn|g|d|h|m|s)\\b/g, m;
        while ((m = re.exec(s)) !== null) {
          var n = parseInt(m[1]), u = m[2];
          if (u === "g") total += n * 86400;
          else if (u === "d") total += hasTurkishDays ? n * 60 : n * 86400;
          else if (u === "h" || u === "sa") total += n * 3600;
          else if (u === "m" || u === "dk") total += n * 60;
          else if (u === "sn") total += n;
          else if (u === "s") total += hasTurkishDays ? n * 3600 : n;
        }
        return total;
      }

      function formatCountdown(ms) {
        var t = Math.max(0, Math.floor(ms / 1000));
        var d = Math.floor(t / 86400);
        var h = Math.floor((t % 86400) / 3600);
        var m = Math.floor((t % 3600) / 60);
        var s = t % 60;
        if (d > 0) return d + "D " + h + "H " + m + "M";
        if (h > 0) return h + "H " + m + "M " + s + "S";
        if (m > 0) return m + "M " + s + "S";
        return s + "S";
      }

      var _obayCountdownTimer = null;

      function startObayCountdown() {
        if (_obayCountdownTimer) clearInterval(_obayCountdownTimer);
        _obayCountdownTimer = setInterval(function() {
          var now = Date.now();
          obayBody.querySelectorAll("td.obay-end-td[data-end-ts]").forEach(function(td) {
            var endTs = parseInt(td.dataset.endTs);
            if (!endTs) return;
            if (now >= endTs) {
              td.dataset.endTs = "0";
              td.innerHTML = _obayCurrentLink
                ? '<a href="' + _obayCurrentLink + '" target="_blank" style="color:var(--yellow);text-decoration:none;">NOW</a>'
                : '<span style="color:var(--yellow);">NOW</span>';
              return;
            }
            td.textContent = formatCountdown(endTs - now);
          });
        }, 1000);
      }

      function sortObayItems(items) {
        if (!_obaySort.key) return items;
        return items.slice().sort(function(a, b) {
          var va, vb;
          if (_obaySort.key === "name") {
            va = String(a.name || "").toLowerCase();
            vb = String(b.name || "").toLowerCase();
            return _obaySort.dir * va.localeCompare(vb);
          }
          if (_obaySort.key === "bid") {
            va = parseBid(a.minimumBid);
            vb = parseBid(b.minimumBid);
            return _obaySort.dir * (va - vb);
          }
          if (_obaySort.key === "end") {
            va = a._endTs || 0;
            vb = b._endTs || 0;
            return _obaySort.dir * (va - vb);
          }
          return 0;
        });
      }

      function updateSortIndicators() {
        ["name","bid","end"].forEach(function(k) {
          var el = document.getElementById("obaySort_" + k);
          if (!el) return;
          el.textContent = _obaySort.key === k ? (_obaySort.dir === 1 ? " ▲" : " ▼") : "";
        });
      }

      document.querySelectorAll("#obayCompactPanel th[data-sort]").forEach(function(th) {
        th.addEventListener("click", function() {
          var key = th.dataset.sort;
          if (_obaySort.key === key) {
            _obaySort.dir *= -1;
          } else {
            _obaySort.key = key;
            _obaySort.dir = 1;
          }
          updateSortIndicators();
          applyObayFilters();
        });
      });

      function applyObayFilters() {
        var active = getActiveObayFilters();
        var items = _obayAllItems;
        if (active.length > 0) {
          items = items.filter(function(item) {
            return active.some(function(key) { return matchesObayFilter(item.name, key); });
          });
        }
        items = sortObayItems(items);
        if (items.length === 0) {
          obayBody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);padding:10px 0;text-align:center;">Eşleşen kayıt yok.</td></tr>';
          return;
        }
        var srv = (typeof activeServerFilter !== "undefined" ? activeServerFilter : null) || "nl";
        var obayLink = "https://barafranca." + (srv === "com" ? "com" : srv === "tr" ? "com.tr" : srv === "pt" ? "pt" : "nl") + "/#/?module=Obay&action=auctions";
        _obayCurrentLink = obayLink;
        var nowRender = Date.now();
        var rows = items.map(function(item) {
          var endTs = item._endTs || 0;
          var endContent;
          if (endTs === 0 || nowRender >= endTs) {
            endContent = '<a href="' + obayLink + '" target="_blank" style="color:var(--yellow);text-decoration:none;">NOW</a>';
          } else {
            endContent = formatCountdown(endTs - nowRender);
          }
          return "<tr style='border-bottom:1px solid rgba(255,255,255,0.04)'>" +
            '<td style="padding:5px 8px 5px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;" title="' + item.name + '">' + formatObayName(item.name) + "</td>" +
            '<td style="padding:5px 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;">' + (item.seller || "-") + "</td>" +
            '<td style="padding:5px 8px;text-align:left;">' + (item.minimumBid || "-") + "</td>" +
            '<td style="padding:5px 8px;text-align:left;">' + (item.buyItNow || "-") + "</td>" +
            '<td style="padding:5px 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;">' + (item.bidder || "-") + "</td>" +
            '<td class="obay-end-td" data-end-ts="' + endTs + '" style="padding:5px 0 5px 8px;text-align:left;">' + endContent + "</td>" +
            "</tr>";
        });
        obayBody.innerHTML = rows.join("");
      }

      function renderObayCompact(data) {
        if (!data || !Array.isArray(data.items) || data.items.length === 0) {
          _obayAllItems = [];
          obayBody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);padding:10px 0;text-align:center;">Obay verisi yok.</td></tr>';
          if (obayMeta) obayMeta.textContent = "";
          return;
        }
        var now = Date.now();
        var dataAge = data.updatedAt ? Math.max(0, now / 1000 - data.updatedAt) : 0;
        _obayAllItems = data.items.map(function(item) {
          var endTs = 0;
          if (/^\\d{10,}$/.test(item.endTime)) {
            endTs = Number(item.endTime) * 1000;
          } else {
            var secs = parseEndSeconds(item.endTime);
            endTs = (secs === 0) ? 0 : Math.round(now + (secs - dataAge) * 1000);
          }
          console.log("Obay debug - item:", item.name, "endTime:", item.endTime, "endTs:", endTs, "now:", now, "diff:", endTs - now);
          return Object.assign({}, item, { _endTs: endTs });
        });
        applyObayFilters();
        startObayCountdown();
        if (obayMeta) {
          var t = data.updatedAt ? new Date(data.updatedAt * 1000).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "";
          var staleWarn = dataAge > 300 ? ' <span style="color:#f87171;font-size:11px;">· stale</span>' : "";
          obayMeta.innerHTML = (data.updatedBy || "") + (t ? " · " + t : "") + staleWarn;
        }
      }

      document.querySelectorAll(".obay-filter").forEach(function(cb) {
        cb.addEventListener("change", applyObayFilters);
      });

      function fetchObayCompact() {
        var srvRaw = (typeof activeServerFilter !== "undefined" ? activeServerFilter : "") || "";
        var srv = (srvRaw && srvRaw !== "ALL") ? srvRaw : (function() {
          if (typeof latestState !== "undefined" && latestState && Array.isArray(latestState.players)) {
            var cid = (typeof myClientId !== "undefined" ? myClientId : "") || "";
            var me = latestState.players.find(function(p) { return String(p.clientId || "") === cid; });
            if (me && me.serverId) return me.serverId;
            // Fall back to first non-offline player's server
            var first = latestState.players.find(function(p) { return !p.offline && p.serverId; });
            if (first) return first.serverId;
          }
          return "com";
        })();
        fetch("/api/obay?serverId=" + encodeURIComponent(srv))
          .then(function(r) { return r.json(); })
          .then(function(d) { if (d && d.ok !== false) renderObayCompact(d); })
          .catch(function() {});
      }

      if (obayBtn && obayPanel) {
        function openObayPanel() {
          var r = obayBtn.getBoundingClientRect();
          obayPanel.style.top = (r.bottom + 6) + "px";
          obayPanel.style.right = (window.innerWidth - r.right) + "px";
          obayPanel.style.display = "block";
          fetchObayCompact();
          // Re-fetch after 5s to pick up fresh extension data
          window.setTimeout(function() {
            if (obayPanel.style.display !== "none") fetchObayCompact();
          }, 5000);
        }
        function closeObayPanel() {
          obayPanel.style.display = "none";
          if (_obayCountdownTimer) { clearInterval(_obayCountdownTimer); _obayCountdownTimer = null; }
        }
        obayBtn.addEventListener("click", function(e) {
          e.stopPropagation();
          obayPanel.style.display === "none" ? openObayPanel() : closeObayPanel();
        });
        obayClose && obayClose.addEventListener("click", closeObayPanel);
        document.addEventListener("click", function(e) {
          if (obayPanel.style.display !== "none" && !obayPanel.contains(e.target) && e.target !== obayBtn) closeObayPanel();
        });
      }
    })();
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
      notes: [],
      targets: [],
    };
  } else {
    rooms[roomName].players = rooms[roomName].players || {};
    rooms[roomName].chat = rooms[roomName].chat || [];
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
  const { room, player, game, updatedAt, progression, cooldowns, clientId, serverId, serverName, hostname, cityGiftActive, mailUnreadCount } = req.body || {};

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

  let access = getRoomAccess(room, clientId);

  // Auto-promote: player name matches room owner → reclaim ownership
  // Handles clientId reset (pending or completely new clientId)
  if ((access === "pending" || access === "none") && rooms[room] && rooms[room].ownerPlayer &&
      player.trim().toLowerCase() === rooms[room].ownerPlayer.toLowerCase()) {
    rooms[room].ownerClientId = clientId;
    rooms[room].members = rooms[room].members || {};
    rooms[room].members[clientId] = { player: player.trim(), role: "owner", joinedAt: getServerTime() };
    if (rooms[room].pending && rooms[room].pending[clientId]) {
      delete rooms[room].pending[clientId];
    }
    saveRoomsStore(rooms);
    access = "owner";
  }

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
        health: typeof progression.health === "string" ? progression.health.trim() : "",
        prisonEscape: typeof progression.prisonEscape === "string" ? progression.prisonEscape.trim() : "",
        crimeAttempts: typeof progression.crimeAttempts === "string" ? progression.crimeAttempts.trim() : "",
        carTheftAttempts: typeof progression.carTheftAttempts === "string" ? progression.carTheftAttempts.trim() : "",
        wonRaces: typeof progression.wonRaces === "string" ? progression.wonRaces.trim() : "",
        murders: typeof progression.murders === "string" ? progression.murders.trim() : "",
        bulletsSpent: typeof progression.bulletsSpent === "string" ? progression.bulletsSpent.trim() : "",
        platingLabel: typeof progression.platingLabel === "string" ? progression.platingLabel.trim() : "",
        platingPercent: typeof progression.platingPercent === "string" ? progression.platingPercent.trim() : "",
      }
      : {},
    cooldowns,
    cityGiftActive: cityGiftActive === true,
    mailUnreadCount: Number.isFinite(Number(mailUnreadCount)) ? Math.max(0, Number(mailUnreadCount)) : 0,
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

    const isOwnData = entry.clientId && clientId && entry.clientId === clientId;
    if (room.toLowerCase() === "general" && !isOwnData) {
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
      const allowedKeys = ["heist", "organizedCrime", "megaOrganizedCrime", "race"];
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
      cityGiftActive: entry.cityGiftActive === true,
      mailUnreadCount: Number.isFinite(Number(entry.mailUnreadCount)) ? Math.max(0, Number(entry.mailUnreadCount)) : 0,
      progression,
      cooldowns,
    };
  });

  let selfProgression = null;
  if (clientId) {
    const { serverId: selfServerId } = req.query;
    const srv = (selfServerId || "").toLowerCase();
    const findSelf = function(playersObj) {
      const entries = Object.values(playersObj || {}).filter(function(e) { return e.clientId === clientId; });
      if (!entries.length) return null;
      if (srv) {
        return entries.find(function(e) { return (e.serverId || "").toLowerCase() === srv; }) || null;
      }
      return entries[0];
    };
    const selfEntry = findSelf(roomData.players) || findSelf((rooms["General"] || {}).players);
    if (selfEntry) selfProgression = selfEntry.progression || null;
  }

  res.json({
    room,
    serverTime,
    players,
    notes: roomData.notes || [],
    targets: roomData.targets || [],
    selfProgression,
  });
});

app.post("/api/obay/update", requireFamilyKey, (req, res) => {
  const { player, updatedAt, items, serverId } = req.body || {};

  if (typeof player !== "string" || !player.trim()) {
    res.status(400).json({ ok: false, error: "Player is required" });
    return;
  }

  if (!Array.isArray(items)) {
    res.status(400).json({ ok: false, error: "Items must be an array" });
    return;
  }

  const targetServerId = (serverId || "com").toLowerCase();
  obayData[targetServerId] = {
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : getServerTime(),
    updatedBy: player.trim(),
    items: items.map((item) => ({
      name: typeof item.name === "string" ? item.name.trim() : "",
      seller: typeof item.seller === "string" ? item.seller.trim() : "",
      minimumBid: typeof item.minimumBid === "string" ? item.minimumBid.trim() : "",
      buyItNow: typeof item.buyItNow === "string" ? item.buyItNow.trim() : "",
      bidder: typeof item.bidder === "string" ? item.bidder.trim() : "",
      endTime: typeof item.endTime === "string" ? item.endTime.trim() : "",
    })),
  };
  saveObayStore();

  res.json({ ok: true });
});

app.get("/api/obay", (req, res) => {
  const { serverId } = req.query;
  const targetServerId = (serverId || "com").toLowerCase();
  const obay = obayData[targetServerId] || { updatedAt: 0, updatedBy: "", items: [] };

  res.json({
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

  const actorName = (player || 'Unknown').trim();
  const sysId = 'sys_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
  roomData.chat = roomData.chat || [];
  roomData.chat.push({
    id: sysId,
    player: '⚙️ System',
    message: '🎯 ' + name.trim() + ' added by ' + actorName,
    createdAt: getServerTime(),
    pinned: false,
    system: true,
    type: 'target-add',
    targetName: name.trim(),
    addedBy: actorName,
  });
  if (roomData.chat.length > 100) {
    roomData.chat = roomData.chat.slice(-100);
  }

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
    type: 'target-dead',
    targetName: target.name,
    addedBy: actorName,
    isDead: target.dead,
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

app.post("/api/game-chat", (req, res) => {
  const validServers = ["tr", "nl", "com", "pt"];
  const validKinds = ["general", "crimes"];
  const srv = String((req.body || {}).serverId || "").toLowerCase();
  const k = String((req.body || {}).kind || "").toLowerCase();
  const history = (req.body || {}).history;

  if (!validServers.includes(srv)) {
    return res.status(400).json({ ok: false, error: "Invalid serverId" });
  }
  if (!validKinds.includes(k)) {
    return res.status(400).json({ ok: false, error: "Invalid kind" });
  }
  if (!Array.isArray(history)) {
    return res.status(400).json({ ok: false, error: "history must be an array" });
  }

  if (!gameChatStore[srv]) {
    gameChatStore[srv] = { general: [], crimes: [] };
  }

  const serverTime = String((req.body || {}).serverTime || "").trim();
  const serverTimeSyncedAt = Number((req.body || {}).serverTimeSyncedAt) || 0;
  if (serverTime && serverTimeSyncedAt) {
    gameChatStore[srv].serverTime = serverTime;
    gameChatStore[srv].serverTimeSyncedAt = serverTimeSyncedAt;
  }

  const store = gameChatStore[srv][k];
  const seenIds = new Set(store.map((m) => String(m.id)));

  for (const msg of history) {
    if (!msg || msg.id == null) continue;
    const msgId = String(msg.id);
    if (seenIds.has(msgId)) continue;
    store.push({
      id: msgId,
      user_name: String(msg.user_name || ""),
      message: String(msg.message || ""),
      created_at: String(msg.created_at || "")
    });
    seenIds.add(msgId);
  }

  if (store.length > 200) {
    gameChatStore[srv][k] = store.slice(-200);
  }

  res.json({ ok: true });
});

app.get("/api/game-chat", (req, res) => {
  const validServers = ["tr", "nl", "com", "pt"];
  const validKinds = ["general", "crimes"];
  const srv = String(req.query.serverId || "").toLowerCase();
  const k = String(req.query.kind || "").toLowerCase();

  if (!validServers.includes(srv)) {
    return res.status(400).json({ ok: false, error: "Invalid serverId" });
  }
  if (!validKinds.includes(k)) {
    return res.status(400).json({ ok: false, error: "Invalid kind" });
  }

  const messages = (gameChatStore[srv] && gameChatStore[srv][k]) || [];
  const serverTime = (gameChatStore[srv] && gameChatStore[srv].serverTime) || "";
  const serverTimeSyncedAt = (gameChatStore[srv] && gameChatStore[srv].serverTimeSyncedAt) || 0;
  res.json({ ok: true, messages, serverTime, serverTimeSyncedAt });
});

app.post("/api/game-chat-outbox", (req, res) => {
  const validServers = ["tr", "nl", "com", "pt"];
  const validKinds = ["general", "crimes"];
  const serverId = String(req.body.serverId || "").toLowerCase();
  const kind = String(req.body.kind || "").toLowerCase();
  const message = String(req.body.message || "").trim();
  if (!validServers.includes(serverId)) return res.status(400).json({ ok: false, error: "Invalid serverId" });
  if (!validKinds.includes(kind)) return res.status(400).json({ ok: false, error: "Invalid kind" });
  if (!message) return res.status(400).json({ ok: false, error: "Empty message" });
  const id = ++gameChatOutboxCounter;
  gameChatOutbox.push({ id, serverId, kind, message, createdAt: Date.now() });
  const cutoff = Date.now() - 30000;
  while (gameChatOutbox.length && gameChatOutbox[0].createdAt < cutoff) gameChatOutbox.shift();
  res.json({ ok: true, id });
});

app.get("/api/game-chat-outbox", (req, res) => {
  const serverId = String(req.query.serverId || "").toLowerCase();
  const pending = gameChatOutbox.filter(m => m.serverId === serverId);
  pending.forEach(m => {
    const idx = gameChatOutbox.indexOf(m);
    if (idx !== -1) gameChatOutbox.splice(idx, 1);
  });
  res.json({ ok: true, messages: pending });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Omerta Portal server running on http://localhost:${port}`);
});
