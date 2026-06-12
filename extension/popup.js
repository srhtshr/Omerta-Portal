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
  ROOM: "TestRoom",
  POLL_INTERVAL_MS: 1000,
  FAMILY_KEY: "",
  MANUAL_ALIAS: "",
  LAST_PLAYER: "",
  LAST_UPDATE: "",
  LAST_ERROR: "",
  ACTIVE_ROOM: "TestRoom",
  enabled: true,
  apiUrl: "http://localhost:3000",
  room: "TestRoom",
  pollIntervalMs: 1000,
  familyKey: "",
  manualAlias: "",
  lastDetectedPlayer: "",
  lastUpdateAt: "",
  lastError: "",
  activeRoom: "TestRoom",
};

const sendNowButton = document.getElementById("sendNowButton");
const openDashboardButton = document.getElementById("openDashboardButton");
const settingsFeedback = document.getElementById("settingsFeedback");

const statusConnection = document.getElementById("statusConnection");
const statusPlayer = document.getElementById("statusPlayer");
const statusUpdated = document.getElementById("statusUpdated");
const statusCooldownsCount = document.getElementById("statusCooldownsCount");
const statusParserError = document.getElementById("statusParserError");
const statusRoom = document.getElementById("statusRoom");

const DISPLAY_ROOM_NAME = "TestRoom";
const STORED_ROOM_NAME = "TestRoom";

function normalizeApiUrl(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || DEFAULT_SETTINGS.apiUrl;
}

function setFeedback(element, type, message) {
  element.className = "feedback" + (type ? " " + type : "");
  element.textContent = message || "";
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;
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
  return chrome.storage.local.get(DEFAULT_SETTINGS);
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
  const lastCooldownsCount = readStatusValue(settings, "LAST_COOLDOWNS_COUNT", "lastCooldownsCount", "0");
  statusPlayer.textContent = readStatusValue(settings, "LAST_PLAYER", "lastDetectedPlayer", "-") || "-";
  statusUpdated.textContent = formatDateTime(lastUpdate);
  statusCooldownsCount.textContent = String(lastCooldownsCount || "0");
  statusParserError.textContent = lastParserError || "-";
  statusRoom.textContent = DISPLAY_ROOM_NAME;

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

async function getActiveTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  return tabs[0] || null;
}

async function sendNow() {
  await applySimplifiedDefaults();

  const tab = await getActiveTab();
  if (!tab || typeof tab.id !== "number") {
    setFeedback(settingsFeedback, "error", "No active tab found.");
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "SEND_NOW",
    });

    if (!response || !response.ok) {
      throw new Error((response && response.error) || "Content script did not complete the update.");
    }

    await loadSettingsAndStatus();
    setFeedback(settingsFeedback, "success", "Manual update sent.");
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
  const player = settings.LAST_PLAYER || settings.lastDetectedPlayer || "";
  
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
