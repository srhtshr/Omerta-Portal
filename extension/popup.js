async function getOrCreateClientId() {
  let stored = await chrome.storage.local.get("CLIENT_ID");
  if (!stored.CLIENT_ID) {
    const newId = "client_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    await chrome.storage.local.set({ CLIENT_ID: newId });
    return newId;
  }
  return stored.CLIENT_ID;
}

const DEFAULT_SETTINGS = {
  ENABLED: true,
  API_URL: "http://localhost:3000",
  ROOM: "General",
  POLL_INTERVAL_MS: 1000,
  FAMILY_KEY: "",
  MANUAL_ALIAS: "",
  LAST_PLAYER: "",
  LAST_PLAYER_TR: "",
  LAST_PLAYER_COM: "",
  LAST_PLAYER_NL: "",
  LAST_PLAYER_PT: "",
  LAST_UPDATE: "",
  LAST_ERROR: "",
  ACTIVE_ROOM: "General",
  enabled: true,
  apiUrl: "http://localhost:3000",
  room: "General",
  pollIntervalMs: 1000,
  familyKey: "",
  manualAlias: "",
  lastDetectedPlayer: "",
  lastUpdateAt: "",
  lastError: "",
  activeRoom: "General",
};

const sendNowButton = document.getElementById("sendNowButton");
const openDashboardButton = document.getElementById("openDashboardButton");
const settingsFeedback = document.getElementById("settingsFeedback");

const statusConnection = document.getElementById("statusConnection");
const statusUpdated = document.getElementById("statusUpdated");
const statusParserError = document.getElementById("statusParserError");
const statusRoom = document.getElementById("statusRoom");

const statusPlayerTR = document.getElementById("statusPlayerTR");
const statusPlayerCOM = document.getElementById("statusPlayerCOM");
const statusPlayerNL = document.getElementById("statusPlayerNL");
const statusPlayerPT = document.getElementById("statusPlayerPT");

const STORED_ROOM_NAME = "General";
const OMERTA_TAB_PATTERNS = [
  "*://barafranca.nl/*",
  "*://*.barafranca.nl/*",
  "*://barafranca.pt/*",
  "*://*.barafranca.pt/*",
  "*://omerta.pt/*",
  "*://*.omerta.pt/*",
  "*://barafranca.com.tr/*",
  "*://*.barafranca.com.tr/*",
  "*://omerta.com.tr/*",
  "*://*.omerta.com.tr/*",
  "*://barafranca.com/*",
  "*://*.barafranca.com/*",
  "*://omerta.dm/*",
  "*://*.omerta.dm/*"
];

function normalizeApiUrl(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || DEFAULT_SETTINGS.apiUrl;
}

function setFeedback(element, type, message) {
  element.className = "feedback" + (type ? " " + type : "");
  element.textContent = message || "";
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

async function getSettings() {
  const all = await chrome.storage.local.get(null);
  return { ...DEFAULT_SETTINGS, ...all };
}

function readStatusValue(settings, uppercaseKey, lowercaseKey, fallback = "") {
  return settings[uppercaseKey] || settings[lowercaseKey] || fallback;
}

function readSettingValue(settings, uppercaseKey, lowercaseKey, fallback = "") {
  if (typeof settings[uppercaseKey] === "boolean") {
    return settings[uppercaseKey];
  }

  if (typeof settings[lowercaseKey] === "boolean") {
    return settings[lowercaseKey];
  }

  return settings[uppercaseKey] || settings[lowercaseKey] || fallback;
}

async function applySimplifiedDefaults() {
  const payload = {
    ENABLED: true,
    API_URL: DEFAULT_SETTINGS.API_URL,
    ROOM: STORED_ROOM_NAME,
    POLL_INTERVAL_MS: DEFAULT_SETTINGS.pollIntervalMs,
    FAMILY_KEY: "",
    MANUAL_ALIAS: "",
    ACTIVE_ROOM: STORED_ROOM_NAME,
    enabled: true,
    apiUrl: DEFAULT_SETTINGS.API_URL,
    room: STORED_ROOM_NAME,
    pollIntervalMs: DEFAULT_SETTINGS.pollIntervalMs,
    familyKey: "",
    manualAlias: "",
    activeRoom: STORED_ROOM_NAME,
  };

  await getOrCreateClientId();
  await chrome.storage.local.set(payload);
  return payload;
}

async function loadSettingsAndStatus() {
  const settings = await getSettings();
  const lastError = readStatusValue(settings, "LAST_ERROR", "lastError", "");
  const lastUpdate = readStatusValue(settings, "LAST_UPDATE", "lastUpdateAt", "");
  const lastParserError = readStatusValue(settings, "LAST_PARSER_ERROR", "lastParserError", "");
  
  statusPlayerTR.textContent = settings.LAST_PLAYER_TR || "-";
  statusPlayerCOM.textContent = settings.LAST_PLAYER_COM || "-";
  statusPlayerNL.textContent = settings.LAST_PLAYER_NL || "-";
  statusPlayerPT.textContent = settings.LAST_PLAYER_PT || "-";
  
  statusUpdated.textContent = formatDateTime(lastUpdate);
  statusParserError.textContent = lastParserError || "-";
  statusRoom.textContent = readStatusValue(settings, "ACTIVE_ROOM", "activeRoom") || readStatusValue(settings, "ROOM", "room") || "General";

  if (lastError) {
    statusConnection.textContent = "Error";
    statusConnection.className = "error";
  } else if (lastUpdate) {
    statusConnection.textContent = "Connected";
    statusConnection.className = "connected";
  } else {
    statusConnection.textContent = "Waiting...";
    statusConnection.className = "waiting";
  }
}

async function getOmertaTabs() {
  const tabs = await chrome.tabs.query({
    url: OMERTA_TAB_PATTERNS,
  });

  return tabs.filter((tab) => typeof tab.id === "number");
}

async function sendNow() {
  await applySimplifiedDefaults();

  const tabs = await getOmertaTabs();
  if (tabs.length === 0) {
    setFeedback(settingsFeedback, "error", "No open Omerta tab found.");
    return;
  }

  try {
    await Promise.all(
      tabs.map(async (tab) => {
        await chrome.tabs.reload(tab.id);
      })
    );

    window.setTimeout(() => {
      loadSettingsAndStatus();
    }, 2000);
    setFeedback(settingsFeedback, "success", "Refreshing " + tabs.length + " Omerta tab(s)...");
  } catch (error) {
    await chrome.storage.local.set({ LAST_ERROR: error.message, lastError: error.message });
    await loadSettingsAndStatus();
    setFeedback(settingsFeedback, "error", error.message);
  }
}

sendNowButton.addEventListener("click", () => {
  sendNow();
});

openDashboardButton.addEventListener("click", async () => {
  setFeedback(settingsFeedback, "", "");
  const settings = await getSettings();
  const player = settings.LAST_PLAYER || settings.lastDetectedPlayer || settings.LAST_PLAYER_TR || settings.LAST_PLAYER_COM || settings.LAST_PLAYER_NL || settings.LAST_PLAYER_PT || "";
  
  if (player) {
    const apiUrl = normalizeApiUrl(readSettingValue(settings, "API_URL", "apiUrl", DEFAULT_SETTINGS.apiUrl));
    const targetUrl = apiUrl.replace(/\/+$/, "") + "/";
    chrome.tabs.create({ url: targetUrl });
  } else {
    setFeedback(settingsFeedback, "error", "Connect first: player name not detected.");
  }
});

applySimplifiedDefaults().then(() => {
  return loadSettingsAndStatus();
});
