const DEFAULT_API_URL = "https://omerta-portal.onrender.com";

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
  API_URL: DEFAULT_API_URL,
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
  apiUrl: DEFAULT_API_URL,
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
  const existing = await chrome.storage.local.get([
    "ROOM",
    "room",
    "ACTIVE_ROOM",
    "activeRoom",
    "API_URL",
    "apiUrl",
    "ENABLED",
    "enabled",
    "POLL_INTERVAL_MS",
    "pollIntervalMs",
    "FAMILY_KEY",
    "familyKey",
    "MANUAL_ALIAS",
    "manualAlias"
  ]);
  const currentRoom = existing.ROOM || existing.room || existing.ACTIVE_ROOM || existing.activeRoom || STORED_ROOM_NAME;
  const currentApiUrl = existing.API_URL || existing.apiUrl || DEFAULT_SETTINGS.API_URL;
  const payload = {
    ENABLED: typeof existing.ENABLED === "boolean" ? existing.ENABLED : true,
    API_URL: currentApiUrl,
    ROOM: currentRoom,
    POLL_INTERVAL_MS: Number(existing.POLL_INTERVAL_MS || existing.pollIntervalMs) || DEFAULT_SETTINGS.pollIntervalMs,
    FAMILY_KEY: existing.FAMILY_KEY || existing.familyKey || "",
    MANUAL_ALIAS: existing.MANUAL_ALIAS || existing.manualAlias || "",
    ACTIVE_ROOM: currentRoom,
    enabled: typeof existing.enabled === "boolean" ? existing.enabled : true,
    apiUrl: currentApiUrl,
    room: currentRoom,
    pollIntervalMs: Number(existing.pollIntervalMs || existing.POLL_INTERVAL_MS) || DEFAULT_SETTINGS.pollIntervalMs,
    familyKey: existing.familyKey || existing.FAMILY_KEY || "",
    manualAlias: existing.manualAlias || existing.MANUAL_ALIAS || "",
    activeRoom: currentRoom,
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
  const apiUrl = normalizeApiUrl(readSettingValue(settings, "API_URL", "apiUrl", DEFAULT_SETTINGS.apiUrl));
  const targetUrl = apiUrl.replace(/\/+$/, "") + "/";
  chrome.tabs.create({ url: targetUrl });
});

applySimplifiedDefaults().then(() => {
  return loadSettingsAndStatus();
});
