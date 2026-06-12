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
        pending: room.pending || {}
      };
    }
    fs.writeFileSync(roomsFilePath, JSON.stringify(persisted, null, 2), "utf8");
  } catch (error) {
    console.error("Failed to save rooms store", error);
  }
}

const rooms = loadRoomsStore();
if (Object.keys(rooms).length === 0) {
  rooms["TestRoom"] = {
    ownerClientId: "",
    ownerPlayer: "",
    members: {},
    pending: {},
    players: {},
    chat: [],
    obay: null
  };
  saveRoomsStore(rooms);
}

app.use(cors());
app.use(express.json());

function getServerTime() {
  return Math.floor(Date.now() / 1000);
}

function renderDashboardHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Omerta Family Cooldown Room v1.0</title>
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
        grid-template-columns: minmax(0, 3.1fr) minmax(280px, 0.9fr);
        gap: 12px;
      }

      .panel {
        background: rgba(23, 29, 39, 0.92);
        border: 1px solid var(--border);
        border-radius: 14px;
        overflow: hidden;
        backdrop-filter: blur(10px);
      }

      .main-column {
        display: grid;
        gap: 12px;
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
        width: 92px;
      }

      th:nth-child(3),
      td:nth-child(3),
      th:nth-child(4),
      td:nth-child(4) {
        width: 104px;
      }

      th:nth-child(5),
      td:nth-child(5) {
        width: 58px;
      }

      th:nth-child(n + 6):nth-child(-n + 18),
      td:nth-child(n + 6):nth-child(-n + 18) {
        width: 58px;
        overflow: visible;
        text-overflow: clip;
        font-size: 10px;
      }

      th:last-child,
      td:last-child {
        width: 70px;
      }

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
        display: grid;
        grid-template-rows: auto 1fr auto;
        min-height: 560px;
      }

      .chat-messages {
        padding: 12px;
        overflow: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 460px;
        background: #0b141a; /* WhatsApp dark theme bg */
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
      }

      .chat-item.own {
        align-self: flex-end;
        background: #005c4b; /* WhatsApp own bubble color */
        color: #edf2f7;
        border-bottom-right-radius: 2px;
      }

      .chat-item.other {
        align-self: flex-start;
        background: #202c33; /* WhatsApp other bubble color */
        color: #edf2f7;
        border-bottom-left-radius: 2px;
      }

      .chat-content {
        word-break: break-word;
      }

      .chat-player {
        color: var(--yellow);
        font-weight: 700;
        margin-right: 4px;
      }

      .chat-text {
        color: var(--text);
      }

      .chat-time {
        align-self: flex-end;
        color: #8696a0; /* WhatsApp muted gray time */
        font-size: 8px;
        margin-top: 3px;
        white-space: nowrap;
      }

      .chat-form {
        padding: 10px;
        border-top: 1px solid var(--border);
        display: grid;
        gap: 6px;
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
        margin-bottom: 14px;
        flex-wrap: wrap;
        border-bottom: 1px solid var(--border);
        padding-bottom: 10px;
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

      @media (max-width: 1100px) {
        .layout {
          grid-template-columns: 1fr;
        }

        .chat {
          min-height: 0;
        }

        .chat-messages {
          max-height: 320px;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="topbar">
        <div class="brand">Omerta Family Cooldown Room v1.0</div>
        <input id="roomInput" type="hidden" value="TestRoom">
        <input id="searchInput" class="input search-input" type="text" placeholder="Search player..." autocomplete="off" title="Filter players by name">
        <button id="applyRoomButton" class="button" type="button" style="display: none;">Open Room</button>
      </div>

      <!-- Room Bar -->
      <div class="room-bar">
        <div id="roomTabsContainer" style="display: flex; gap: 6px; flex-wrap: wrap;"></div>
        <div style="margin-left: auto; display: flex; gap: 6px; align-items: center;">
          <input id="newRoomInput" class="input" type="text" placeholder="Room Name..." style="min-width: 140px; padding: 6px 10px;" maxlength="32">
          <button id="createRoomBtn" class="button" type="button" style="padding: 6px 12px;">Create</button>
          <button id="joinRoomBtn" class="button" type="button" style="padding: 6px 12px;">Join</button>
        </div>
      </div>

      <!-- Unauthorized View overlay -->
      <div id="unauthorizedView" style="display: none; padding: 40px; text-align: center; background: rgba(23, 29, 39, 0.92); border: 1px solid var(--border); border-radius: 14px; margin-bottom: 14px; backdrop-filter: blur(10px);">
         <div id="unauthorizedIcon" style="font-size: 48px; margin-bottom: 16px;">🔒</div>
         <h2 id="unauthorizedTitle" style="margin: 0 0 10px 0;">Access Restricted</h2>
         <p id="unauthorizedMessage" style="color: var(--muted); margin-bottom: 20px; font-size: 14px;">You are not a member of this room.</p>
         <button id="unauthorizedJoinBtn" class="button" style="display: none; padding: 8px 16px;">Join Room</button>
      </div>

      <div class="layout">
        <div class="main-column">
          <!-- Room Administration (Owner) Panel -->
          <section id="adminPanel" class="panel" style="display: none; margin-bottom: 12px;">
            <div class="panel-header">
              <div class="panel-title">Room Administration (Owner)</div>
            </div>
            <div style="padding: 12px; display: grid; grid-template-columns: 1fr 1.2fr; gap: 12px;">
              <div>
                <h4 style="margin: 0 0 8px 0; font-size: 12px; color: var(--yellow);">Pending Requests</h4>
                <div style="max-height: 180px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; background: rgba(0,0,0,0.15);">
                  <table style="width: 100%;">
                    <thead>
                      <tr>
                        <th style="font-size: 10px; padding: 4px; text-align: left; padding-left: 8px;">Player</th>
                        <th style="font-size: 10px; padding: 4px;">Actions</th>
                      </tr>
                    </thead>
                    <tbody id="pendingTableBody">
                      <tr>
                        <td colspan="2" class="muted" style="padding: 8px; font-size: 10px;">No pending requests.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h4 style="margin: 0 0 8px 0; font-size: 12px; color: var(--accent);">Room Members</h4>
                <div style="max-height: 180px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; background: rgba(0,0,0,0.15);">
                  <table style="width: 100%;">
                    <thead>
                      <tr>
                        <th style="font-size: 10px; padding: 4px; text-align: left; padding-left: 8px;">Player</th>
                        <th style="font-size: 10px; padding: 4px; text-align: left; padding-left: 8px;">Role</th>
                        <th style="font-size: 10px; padding: 4px;">Actions</th>
                      </tr>
                    </thead>
                    <tbody id="membersTableBody">
                      <tr>
                        <td colspan="3" class="muted" style="padding: 8px; font-size: 10px;">No members.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header">
              <div>
                <div id="roomTitle" class="panel-title">TestRoom</div>
                <div id="stateMeta" class="status-line">Waiting for room selection.</div>
              </div>
              <a class="panel-link" href="https://barafranca.nl/#/garage.php" target="_blank" rel="noopener noreferrer">Garage</a>
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
                    <th title="Crims"><a class="header-link" href="https://barafranca.nl/#/?module=Crimes" target="_blank" rel="noopener noreferrer">Crims</a></th>
                    <th title="Car"><a class="header-link" href="https://barafranca.nl/#/?module=Cars" target="_blank" rel="noopener noreferrer">Car</a></th>
                    <th title="Race">Race</th>
                    <th title="Heist"><a class="header-link" href="https://barafranca.nl/#/?module=GroupCrimes" target="_blank" rel="noopener noreferrer">Heist</a></th>
                    <th title="Oc"><a class="header-link" href="https://barafranca.nl/#/?module=GroupCrimes" target="_blank" rel="noopener noreferrer">Oc</a></th>
                    <th title="Moc"><a class="header-link" href="https://barafranca.nl/#/?module=GroupCrimes" target="_blank" rel="noopener noreferrer">Moc</a></th>
                    <th title="Spots"><a class="header-link" href="https://barafranca.nl/#/?module=GroupCrimes" target="_blank" rel="noopener noreferrer">Spots</a></th>
                    <th title="Alchol"><a class="header-link" href="https://barafranca.nl/#/smuggling.php" target="_blank" rel="noopener noreferrer">Alchol</a></th>
                    <th title="Drug"><a class="header-link" href="https://barafranca.nl/#/smuggling.php" target="_blank" rel="noopener noreferrer">Drug</a></th>
                    <th title="Bullet"><a class="header-link" href="https://barafranca.nl/#/bullets2.php" target="_blank" rel="noopener noreferrer">Bullet</a></th>
                    <th title="Kill"><a class="header-link" href="https://barafranca.nl/#/?module=Detectives" target="_blank" rel="noopener noreferrer">Kill</a></th>
                    <th title="Blood"><a class="header-link" href="https://barafranca.nl/?module=Bloodbank" target="_blank" rel="noopener noreferrer">Blood</a></th>
                    <th title="Fly"><a class="header-link" href="https://barafranca.nl/#/?module=Travel" target="_blank" rel="noopener noreferrer">Fly</a></th>
                    <th title="Update">Update</th>
                  </tr>
                </thead>
                <tbody id="cooldownTableBody">
                  <tr>
                    <td colspan="19" class="muted">No room selected.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header">
              <div>
                <button id="obayToggleButton" class="toggle-button panel-title" type="button">Obay Auctions</button>
                <div id="obayMeta" class="status-line">No Obay data loaded.</div>
              </div>
            </div>
            <div id="obayPanelBody" class="obay-panel-body collapsed">
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

        <aside class="panel chat">
          <div class="panel-header">
            <div>
              <div class="panel-title">Room Chat</div>
              <div id="chatMeta" class="status-line">No messages loaded.</div>
            </div>
          </div>
          <div id="chatMessages" class="chat-messages">
            <div class="chat-empty">Select a room to load chat.</div>
          </div>
          <form id="chatForm" class="chat-form">
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
                <span class="emoji-item">🛩️</span>
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
      const searchInput = document.getElementById("searchInput");
      const applyRoomButton = document.getElementById("applyRoomButton");
      const roomTitle = document.getElementById("roomTitle");
      const stateMeta = document.getElementById("stateMeta");
      const rankSortButton = document.getElementById("rankSortButton");
      const obayToggleButton = document.getElementById("obayToggleButton");
      const obayMeta = document.getElementById("obayMeta");
      const obayPanelBody = document.getElementById("obayPanelBody");
      const obayTableBody = document.getElementById("obayTableBody");
      const chatMeta = document.getElementById("chatMeta");
      const cooldownTableBody = document.getElementById("cooldownTableBody");
      const chatMessages = document.getElementById("chatMessages");
      const chatForm = document.getElementById("chatForm");
      const messageInput = document.getElementById("messageInput");
      const chatFeedback = document.getElementById("chatFeedback");

      const FIXED_ROOM = "TestRoom";
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

      let currentRoom = "";
      let pollTimer = null;
      let obayPollTimer = null;
      let latestState = null;
      let isConnected = false;
      let myPlayerName = "";
      let myClientId = "";
      let userRoomStatus = "none";
      let joinedRooms = ["TestRoom"];
      let activeRoom = "TestRoom";
      let playerSearchTerm = "";
      let rankSortDirection = 0;
      let isObayExpanded = false;

      // Load initial rooms state from localStorage
      try {
        const storedJoined = localStorage.getItem("omerta_joined_rooms");
        if (storedJoined) {
          joinedRooms = JSON.parse(storedJoined);
        }
        const storedActive = localStorage.getItem("omerta_active_room");
        if (storedActive) {
          activeRoom = storedActive;
        }
      } catch (err) {
        console.error("Failed to load room settings from localStorage", err);
      }
      if (!Array.isArray(joinedRooms) || joinedRooms.length === 0) {
        joinedRooms = ["TestRoom"];
      }
      if (!joinedRooms.includes("TestRoom")) {
        joinedRooms.unshift("TestRoom");
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

      function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = String(value);
        return div.innerHTML;
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
        rankSortButton.textContent = rankSortDirection > 0 ? "Rank ↑" : "Rank ↓";
      }

      function updateObayToggleButton() {
        obayToggleButton.textContent = isObayExpanded ? "Obay Auctions ▼" : "Obay Auctions ▶";
        obayPanelBody.className = isObayExpanded ? "obay-panel-body" : "obay-panel-body collapsed";
      }

      function renderPlayers(state) {
        if (!state || !Array.isArray(state.players) || state.players.length === 0) {
          cooldownTableBody.innerHTML = '<tr><td colspan="19" class="muted">No player data for this room yet.</td></tr>';
          return;
        }

        const filteredPlayers = applyPlayerFilters(state.players);
        if (filteredPlayers.length === 0) {
          cooldownTableBody.innerHTML = '<tr><td colspan="19" class="muted">No players match this search.</td></tr>';
          return;
        }

        const rows = filteredPlayers
          .map((entry) => {
            const rowClass = entry.offline ? "player-offline" : "";
            const status = entry.offline
              ? '<span class="status-dot offline" aria-label="Offline"></span>'
              : '<span class="status-dot online" aria-label="Online"></span>';
            const cells = cooldownColumns.map(([keys, shortLabel, fullLabel]) => {
              return '<td title="' + escapeHtml(fullLabel) + '">' + resolveCooldownValue(getCooldownRawValue(entry.cooldowns, keys), state.serverTime) + "</td>";
            }).join("");
            const progression = entry.progression && typeof entry.progression === "object" ? entry.progression : {};
            const rank = progression.rank || "-";
            const progressionPercent = progression.progressionPercent || "-";
            const activityPercent = progression.activityPercent || "-";

            return '<tr class="' + rowClass + '">' +
              '<td title="' + (entry.offline ? "Offline" : "Online") + '">' + status + "</td>" +
              '<td title="' + escapeHtml(entry.player || "-") + '"><span class="text-cell player-name">' + escapeHtml(entry.player || "-") + "</span></td>" +
              '<td title="' + escapeHtml(rank) + '"><span class="text-cell rank-name">' + escapeHtml(rank) + "</span></td>" +
              '<td title="' + escapeHtml(progressionPercent) + '">' + escapeHtml(progressionPercent) + "</td>" +
              '<td title="' + escapeHtml(activityPercent) + '">' + escapeHtml(activityPercent) + "</td>" +
              cells +
              '<td title="' + formatUpdated(Number(entry.updatedAt), state.serverTime) + '">' + formatUpdated(Number(entry.updatedAt), state.serverTime) + "</td>" +
              "</tr>";
          });

        cooldownTableBody.innerHTML = rows.join("");
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

        chatMessages.innerHTML = messages.map((message) => {
          const isOwn = message.player === currentSender;
          const bubbleClass = isOwn ? "own" : "other";
          const playerName = escapeHtml(message.player || "-");
          const msgText = String(message.message || "");
          const timeStr = formatClock(Number(message.createdAt));
          
          return '<div class="chat-item ' + bubbleClass + '">' +
            '<div class="chat-content">' +
            '<span class="chat-player">' + playerName + ':</span>' +
            '<span class="chat-text">' + msgText + '</span>' +
            '</div>' +
            '<span class="chat-time">' + escapeHtml(timeStr) + '</span>' +
            '</div>';
        }).join("");

        chatMessages.scrollTop = chatMessages.scrollHeight;
        chatMeta.textContent = room + " room chat, " + messages.length + " message(s).";
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
          const response = await fetch("/api/obay?room=" + encodeURIComponent(currentRoom) + "&clientId=" + encodeURIComponent(myClientId));
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
          stateMeta.textContent = "Online: 0";
          chatMeta.textContent = "No messages loaded.";
          cooldownTableBody.innerHTML = '<tr><td colspan="19" class="muted">No room selected.</td></tr>';
          chatMessages.innerHTML = '<div class="chat-empty">Select a room to load chat.</div>';
          return;
        }

        if (!isValidRoom(currentRoom)) {
          roomTitle.textContent = currentRoom;
          stateMeta.textContent = "Online: 0";
          cooldownTableBody.innerHTML = '<tr><td colspan="19" class="muted">Invalid room name.</td></tr>';
          chatMessages.innerHTML = '<div class="chat-empty">Invalid room name.</div>';
          return;
        }

        try {
          const statusRes = await fetch("/api/rooms/status?room=" + encodeURIComponent(currentRoom) + "&clientId=" + encodeURIComponent(myClientId));
          const statusData = await statusRes.json();
          userRoomStatus = statusData.status || "none";

          const layoutEl = document.querySelector(".layout");
          const unauthorizedEl = document.getElementById("unauthorizedView");

          if (userRoomStatus === "owner" || userRoomStatus === "member") {
            layoutEl.style.display = "grid";
            unauthorizedEl.style.display = "none";

            const adminPanel = document.getElementById("adminPanel");
            if (userRoomStatus === "owner") {
              adminPanel.style.display = "block";
              loadAdminData();
            } else {
              adminPanel.style.display = "none";
            }

            const [stateResponse, chatResponse] = await Promise.all([
              fetch("/api/state?room=" + encodeURIComponent(currentRoom) + "&clientId=" + encodeURIComponent(myClientId)),
              fetch("/api/chat?room=" + encodeURIComponent(currentRoom) + "&clientId=" + encodeURIComponent(myClientId))
            ]);

            const stateData = await stateResponse.json();
            const chatData = await chatResponse.json();

            if (!stateResponse.ok) {
              throw new Error(stateData.error || "State request failed");
            }

            if (!chatResponse.ok) {
              throw new Error(chatData.error || "Chat request failed");
            }

            latestState = stateData;
            roomTitle.textContent = currentRoom;
            stateMeta.textContent = "Online: " + stateData.players.filter((player) => !player.offline).length;
            renderPlayers(stateData);
            renderChat(currentRoom, chatData.messages);
          } else {
            layoutEl.style.display = "none";
            unauthorizedEl.style.display = "block";

            const titleEl = document.getElementById("unauthorizedTitle");
            const msgEl = document.getElementById("unauthorizedMessage");
            const joinBtn = document.getElementById("unauthorizedJoinBtn");
            const iconEl = document.getElementById("unauthorizedIcon");

            if (userRoomStatus === "pending") {
              iconEl.textContent = "⏳";
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
          }
        } catch (error) {
          latestState = null;
          roomTitle.textContent = currentRoom || FIXED_ROOM;
          stateMeta.textContent = "Failed to load room data.";
          cooldownTableBody.innerHTML = '<tr><td colspan="19" class="muted">Could not load state.</td></tr>';
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
          
          const pendingTable = document.getElementById("pendingTableBody");
          if (pendingData.pending && pendingData.pending.length > 0) {
            pendingTable.innerHTML = pendingData.pending.map((p) => {
              return \`<tr>
                <td style="padding: 4px; font-size: 11px; text-align: left; padding-left: 8px;">\${escapeHtml(p.player)}</td>
                <td style="padding: 4px;">
                <button class="button" style="padding: 2px 6px; font-size: 10px; background: #2e7d32; border: 0; margin-right: 4px;" onclick="approveRequest('\${escapeHtml(p.clientId)}')">Approve</button>
                <button class="button" style="padding: 2px 6px; font-size: 10px; background: #c62828; border: 0;" onclick="rejectRequest('\${escapeHtml(p.clientId)}')">Reject</button>
                </td>
                </tr>\`;
            }).join("");
          } else {
            pendingTable.innerHTML = '<tr><td colspan="2" class="muted" style="padding: 8px; font-size: 10px;">No pending requests.</td></tr>';
          }
          
          const membersTable = document.getElementById("membersTableBody");
          if (membersData.members && membersData.members.length > 0) {
            membersTable.innerHTML = membersData.members.map((m) => {
              const isMe = m.clientId === myClientId;
              const kickBtn = isMe ? "" : \`<button class="button" style="padding: 2px 6px; font-size: 10px; background: #c62828; border: 0;" onclick="kickMember('\${escapeHtml(m.clientId)}')">Kick</button>\`;
              return \`<tr>
                <td style="padding: 4px; font-size: 11px; text-align: left; padding-left: 8px;">\${escapeHtml(m.player)}</td>
                <td style="padding: 4px; font-size: 11px; color: var(--muted); text-align: left; padding-left: 8px;">\${escapeHtml(m.role)}</td>
                <td style="padding: 4px;">\${kickBtn}</td>
                </tr>\`;
            }).join("");
          } else {
            membersTable.innerHTML = '<tr><td colspan="3" class="muted" style="padding: 8px; font-size: 10px;">No members.</td></tr>';
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
          activeRoom = "TestRoom";
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
          const isTest = room === "TestRoom";
          const closeButton = isTest ? "" : \`<span class="room-tab-close" onclick="leaveRoom(event, '\${escapeHtml(room)}')">×</span>\`;
          return \`<div class="room-tab \${isActive ? 'active' : ''}" onclick="selectRoom('\${escapeHtml(room)}')">\` +
            \`<span>\${escapeHtml(room)}</span>\` +
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
        startPolling();
      }

      roomInput.value = FIXED_ROOM;
      roomInput.readOnly = true;
      applyRoomButton.disabled = true;
      applyRoomButton.textContent = "Locked";
      updateRankSortButton();
      updateObayToggleButton();

      searchInput.addEventListener("input", () => {
        playerSearchTerm = searchInput.value || "";
        if (latestState) {
          renderPlayers(latestState);
        }
      });

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

      obayToggleButton.addEventListener("click", () => {
        isObayExpanded = !isObayExpanded;
        updateObayToggleButton();
      });

      chatForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        chatFeedback.className = "feedback";
        chatFeedback.textContent = "";

        const message = messageInput.value.trim();

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

        window.postMessage({ type: "OMERTA_SEND_CHAT", message }, "*");
      });

      function getChatSender() {
        return myPlayerName || "";
      }

      function updateChatFormState() {
        const sendBtn = chatForm.querySelector("button[type='submit']");
        const emojiBtn = document.getElementById("emojiButton");
        if (isConnected && myPlayerName) {
          messageInput.disabled = false;
          if (sendBtn) sendBtn.disabled = false;
          if (emojiBtn) emojiBtn.disabled = false;
          chatFeedback.className = "feedback success";
          chatFeedback.textContent = "Connected as " + myPlayerName;
        } else {
          messageInput.disabled = true;
          if (sendBtn) sendBtn.disabled = true;
          if (emojiBtn) emojiBtn.disabled = true;
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
          isConnected = data.connected;
          myPlayerName = data.player || "";
          myClientId = data.clientId || "";
          
          if (isConnected !== wasConnected || myPlayerName !== oldName || myClientId !== oldClientId) {
            updateChatFormState();
            if (latestState) {
              renderPlayers(latestState);
            }
          }
          
          if (data.room !== activeRoom) {
            window.postMessage({ type: "OMERTA_SET_ROOM", room: activeRoom }, "*");
          }
        } else if (data.type === "OMERTA_CHAT_SENT") {
          messageInput.value = "";
          chatFeedback.className = "feedback";
          chatFeedback.textContent = "";
          updateChatFormState();
          loadStateAndChat();
        } else if (data.type === "OMERTA_CHAT_ERROR") {
          chatFeedback.className = "feedback error";
          chatFeedback.textContent = data.error || "Message send failed";
        }
      });

      // Poll connection status
      window.setInterval(() => {
        window.postMessage({ type: "OMERTA_GET_IDENTITY" }, "*");
      }, 1000);
      window.postMessage({ type: "OMERTA_GET_IDENTITY" }, "*");

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

      // Keydown interaction (Enter sends, Shift+Enter newlines)
      messageInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          chatForm.requestSubmit();
        }
      });

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
    };
  } else {
    rooms[roomName].players = rooms[roomName].players || {};
    rooms[roomName].chat = rooms[roomName].chat || [];
    rooms[roomName].obay = rooms[roomName].obay || null;
    rooms[roomName].members = rooms[roomName].members || {};
    rooms[roomName].pending = rooms[roomName].pending || {};
  }
  return rooms[roomName];
}

function getRoomAccess(roomName, clientId) {
  if (!isValidRoom(roomName)) return "none";
  if (roomName === "TestRoom") return "member";
  
  const room = rooms[roomName];
  if (!room) return "none";
  if (!room.ownerClientId) return "member"; // If room has no owner, it is public
  if (room.ownerClientId === clientId) return "owner";
  
  if (room.members && room.members[clientId]) {
    return room.members[clientId].role || "member";
  }
  
  if (room.pending && room.pending[clientId]) {
    return "pending";
  }
  
  return "none";
}

app.get("/", (_req, res) => {
  res.status(200).send(renderDashboardHtml());
});

app.post("/api/update", requireFamilyKey, (req, res) => {
  const { room, player, game, updatedAt, progression, cooldowns, clientId } = req.body || {};

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
  if (room !== "TestRoom" && rooms[room] && rooms[room].ownerClientId && access !== "owner" && access !== "member") {
    res.status(403).json({ ok: false, error: "Access denied" });
    return;
  }

  const roomData = getOrCreateRoom(room);
  roomData.players[player] = {
    player: player.trim(),
    game: typeof game === "string" ? game : "",
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : getServerTime(),
    progression: isPlainObject(progression)
      ? {
          rank: typeof progression.rank === "string" ? progression.rank.trim() : "",
          progressionPercent: typeof progression.progressionPercent === "string" ? progression.progressionPercent.trim() : "",
          activityPercent: typeof progression.activityPercent === "string" ? progression.activityPercent.trim() : "",
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
  if (room !== "TestRoom" && rooms[room] && rooms[room].ownerClientId && access !== "owner" && access !== "member") {
    res.status(403).json({ ok: false, error: "Access denied" });
    return;
  }

  const serverTime = getServerTime();
  const roomData = rooms[room] || { players: {} };
  const players = Object.values(roomData.players || {}).map((entry) => ({
    player: entry.player,
    game: entry.game,
    updatedAt: entry.updatedAt,
    offline: serverTime - entry.updatedAt > 90,
    progression: entry.progression || {},
    cooldowns: entry.cooldowns,
  }));

  res.json({
    room,
    serverTime,
    players,
  });
});

app.post("/api/obay/update", requireFamilyKey, (req, res) => {
  const { room, player, updatedAt, items, clientId } = req.body || {};

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
  if (room !== "TestRoom" && rooms[room] && rooms[room].ownerClientId && access !== "owner" && access !== "member") {
    res.status(403).json({ ok: false, error: "Access denied" });
    return;
  }

  const roomData = getOrCreateRoom(room);
  roomData.obay = {
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
  const { room, clientId } = req.query;

  if (!isValidRoom(room)) {
    res.status(400).json({ ok: false, error: "Invalid room" });
    return;
  }

  const access = getRoomAccess(room, clientId);
  if (room !== "TestRoom" && rooms[room] && rooms[room].ownerClientId && access !== "owner" && access !== "member") {
    res.status(403).json({ ok: false, error: "Access denied" });
    return;
  }

  const roomData = rooms[room] || { obay: null };
  const obay = roomData.obay || {
    updatedAt: 0,
    updatedBy: "",
    items: [],
  };

  res.json({
    room,
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

  if (typeof message !== "string" || !message.trim()) {
    res.status(400).json({ ok: false, error: "Message is required" });
    return;
  }

  if (message.length > 300) {
    res.status(400).json({ ok: false, error: "Message is too long" });
    return;
  }

  const access = getRoomAccess(room, clientId);
  if (room !== "TestRoom" && rooms[room] && rooms[room].ownerClientId && access !== "owner" && access !== "member") {
    res.status(403).json({ ok: false, error: "Access denied" });
    return;
  }

  const roomData = getOrCreateRoom(room);
  roomData.chat.push({
    player: player.trim(),
    message: escapeHtml(message),
    createdAt: getServerTime(),
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
  if (room !== "TestRoom" && rooms[room] && rooms[room].ownerClientId && access !== "owner" && access !== "member") {
    res.status(403).json({ ok: false, error: "Access denied" });
    return;
  }

  const roomData = rooms[room] || { chat: [] };
  res.json({
    room,
    messages: roomData.chat || [],
  });
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
    return res.status(400).json({ ok: false, error: "Room already exists and is owned by someone else" });
  }

  roomData.ownerClientId = clientId;
  roomData.ownerPlayer = player;
  roomData.members[clientId] = {
    player: player.trim(),
    role: "owner",
    joinedAt: getServerTime()
  };
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
    roomData.ownerClientId = clientId;
    roomData.ownerPlayer = player;
    roomData.members[clientId] = {
      player: player.trim(),
      role: "owner",
      joinedAt: getServerTime()
    };
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

app.listen(port, () => {
  console.log(`Omerta Family Cooldown Room server running on http://localhost:${port}`);
});
