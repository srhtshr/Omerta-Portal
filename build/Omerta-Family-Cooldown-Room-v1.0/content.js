const isDashboard = window.location.origin.includes("localhost:3000") || window.location.origin.includes("127.0.0.1:3000");

async function getOrCreateClientId() {
  let stored = await chrome.storage.local.get("CLIENT_ID");
  if (!stored.CLIENT_ID) {
    const newId = "client_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    await chrome.storage.local.set({ CLIENT_ID: newId });
    return newId;
  }
  return stored.CLIENT_ID;
}

const STORAGE_DEFAULTS = {
  API_URL: "http://localhost:3000",
  ROOM: "TestRoom",
  FAMILY_KEY: "",
  MANUAL_ALIAS: "",
  ENABLED: true,
  POLL_INTERVAL_MS: 1000,
  apiUrl: "http://localhost:3000",
  room: "TestRoom",
  familyKey: "",
  manualAlias: "",
  enabled: true,
  pollIntervalMs: 1000,
};

const STATUS_KEYS = {
  LAST_PLAYER: "LAST_PLAYER",
  LAST_UPDATE: "LAST_UPDATE",
  LAST_ERROR: "LAST_ERROR",
  LAST_PARSER_ERROR: "LAST_PARSER_ERROR",
  LAST_COOLDOWNS_COUNT: "LAST_COOLDOWNS_COUNT",
  ACTIVE_ROOM: "ACTIVE_ROOM",
  lastDetectedPlayer: "lastDetectedPlayer",
  lastUpdateAt: "lastUpdateAt",
  lastError: "lastError",
  lastParserError: "lastParserError",
  lastCooldownsCount: "lastCooldownsCount",
  activeRoom: "activeRoom",
};

const CACHE_KEYS = {
  LAST_KNOWN_PLAYER: "LAST_KNOWN_PLAYER",
  LAST_KNOWN_COOLDOWNS: "LAST_KNOWN_COOLDOWNS",
  LAST_KNOWN_PROGRESSION: "LAST_KNOWN_PROGRESSION",
};

const COOLDOWN_LABELS = {
  crime: [
    "Volgende misdaadpoging",
    "Next crime attempt",
  ],
  car: [
    "Volgende autojatpoging",
    "Next car stealing attempt",
  ],
  heist: [
    "Volgende heist",
    "Next heist",
  ],
  organizedCrime: [
    "Volgende georganiseerde misdaad",
    "Next organized crime",
  ],
  megaOrganizedCrime: [
    "Volgende mega georganiseerde misdaad",
    "Next mega organized crime",
  ],
  flight: [
    "Volgende vlucht",
    "Next flight",
  ],
  bullets: [
    "Volgende kogeltransactie",
    "Next bullet transaction",
  ],
  assassination: [
    "Volgende moordpoging",
    "Next assassination attempt",
  ],
  race: [
    "Volgende autorace",
    "Next car race",
  ],
  blood: [
    "Volgende bloedtransfusie",
    "Next blood transfusion",
  ],
  spot: [
    "Volgende spot overval",
    "Next spot robbery",
  ],
  alcohol: [
    "Drank",
    "Alcohol",
  ],
  drugs: [
    "Drugs",
  ],
};

const PROFILE_FIELD_LABELS = {
  rank: [
    "Rank",
    "Rang",
  ],
  progression: [
    "Rank progression",
    "Rank progress",
    "Progress to next rank",
    "Rang progressie",
    "Rangvordering",
  ],
  activity: [
    "Activity",
    "Activiteit",
  ],
};

const PROFILE_TABLE_HEADERS = [
  "Rank Information",
  "Rank information",
  "Rang informatie",
  "Ranginformatie",
];

const NORMALIZED_LABEL_TO_KEY = buildLabelLookup(COOLDOWN_LABELS);
let pollTimerId = null;
let isPolling = false;
const READY_REFRESH_MS = 60000;
const PARSE_RETRY_MS = 30000;
const MIN_REFRESH_MS = 1000;
let lastKnownCooldowns = null;
let lastKnownProgression = null;
let lastKnownPlayer = "";
let cacheLoaded = false;
let iframeParseInFlight = null;

function buildLabelLookup(source) {
  const map = {};

  for (const [key, labels] of Object.entries(source)) {
    for (const label of labels) {
      map[normalizeText(label)] = key;
    }
  }

  return map;
}

function matchCooldownKey(labelText) {
  const normalizedLabel = normalizeText(labelText);
  if (!normalizedLabel) {
    return "";
  }

  if (NORMALIZED_LABEL_TO_KEY[normalizedLabel]) {
    return NORMALIZED_LABEL_TO_KEY[normalizedLabel];
  }

  for (const [key, labels] of Object.entries(COOLDOWN_LABELS)) {
    for (const label of labels) {
      const normalizedKnown = normalizeText(label);
      if (
        normalizedLabel.includes(normalizedKnown) ||
        normalizedKnown.includes(normalizedLabel)
      ) {
        return key;
      }
    }
  }

  return "";
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getUnixTime() {
  return Math.floor(Date.now() / 1000);
}

function getNextRefreshDelayMs(cooldowns, parserError) {
  if (parserError) {
    return PARSE_RETRY_MS;
  }

  const now = getUnixTime();
  let nearestTimeEnd = Infinity;

  for (const value of Object.values(cooldowns || {})) {
    if (!value || typeof value !== "object") {
      continue;
    }

    if (value.ready === true || Number(value.timeEnd) === 0) {
      continue;
    }

    const timeEnd = Number(value.timeEnd);
    if (!Number.isFinite(timeEnd)) {
      continue;
    }

    if (timeEnd < nearestTimeEnd) {
      nearestTimeEnd = timeEnd;
    }
  }

  if (!Number.isFinite(nearestTimeEnd)) {
    return READY_REFRESH_MS;
  }

  return Math.max(MIN_REFRESH_MS, ((nearestTimeEnd + 2) - now) * 1000);
}

function cloneJsonSafe(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}

function sanitizeRoom(room) {
  const value = typeof room === "string" ? room.trim() : "";
  if (!value) {
    return "default";
  }

  if (!/^[A-Za-z0-9_-]{1,32}$/.test(value)) {
    return "default";
  }

  return value;
}

function trimToString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isObayAuctionsPage() {
  const href = window.location.href || "";
  return href.includes("module=Obay") && href.includes("action=auctions");
}

function getInformationIframeUrl() {
  return "https://barafranca.nl/#/information.php";
}

async function readSettings() {
  const stored = await chrome.storage.local.get(STORAGE_DEFAULTS);

  return {
    apiUrl: trimToString(stored.API_URL || stored.apiUrl) || STORAGE_DEFAULTS.API_URL,
    room: sanitizeRoom(stored.ROOM || stored.room),
    familyKey: trimToString(stored.FAMILY_KEY || stored.familyKey),
    manualAlias: trimToString(stored.MANUAL_ALIAS || stored.manualAlias),
    enabled: typeof stored.ENABLED === "boolean" ? stored.ENABLED : Boolean(stored.enabled),
    pollIntervalMs: Number(stored.POLL_INTERVAL_MS || stored.pollIntervalMs) || STORAGE_DEFAULTS.POLL_INTERVAL_MS,
  };
}

async function writeStatus(updates) {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(updates, "player")) {
    payload[STATUS_KEYS.LAST_PLAYER] = updates.player;
    payload[STATUS_KEYS.lastDetectedPlayer] = updates.player;
  }

  if (Object.prototype.hasOwnProperty.call(updates, "updated")) {
    payload[STATUS_KEYS.LAST_UPDATE] = updates.updated;
    payload[STATUS_KEYS.lastUpdateAt] = updates.updated;
  }

  if (Object.prototype.hasOwnProperty.call(updates, "error")) {
    payload[STATUS_KEYS.LAST_ERROR] = updates.error;
    payload[STATUS_KEYS.lastError] = updates.error;
  }

  if (Object.prototype.hasOwnProperty.call(updates, "room")) {
    payload[STATUS_KEYS.ACTIVE_ROOM] = updates.room;
    payload[STATUS_KEYS.activeRoom] = updates.room;
  }

  if (Object.prototype.hasOwnProperty.call(updates, "parserError")) {
    payload[STATUS_KEYS.LAST_PARSER_ERROR] = updates.parserError;
    payload[STATUS_KEYS.lastParserError] = updates.parserError;
  }

  if (Object.prototype.hasOwnProperty.call(updates, "cooldownsCount")) {
    payload[STATUS_KEYS.LAST_COOLDOWNS_COUNT] = updates.cooldownsCount;
    payload[STATUS_KEYS.lastCooldownsCount] = updates.cooldownsCount;
  }

  if (Object.keys(payload).length > 0) {
    await chrome.storage.local.set(payload);
  }
}

async function loadCachedSnapshot() {
  if (cacheLoaded) {
    return;
  }

  const stored = await chrome.storage.local.get({
    [CACHE_KEYS.LAST_KNOWN_PLAYER]: "",
    [CACHE_KEYS.LAST_KNOWN_COOLDOWNS]: null,
    [CACHE_KEYS.LAST_KNOWN_PROGRESSION]: null,
  });

  lastKnownPlayer = trimToString(stored[CACHE_KEYS.LAST_KNOWN_PLAYER]);
  lastKnownCooldowns = stored[CACHE_KEYS.LAST_KNOWN_COOLDOWNS] && typeof stored[CACHE_KEYS.LAST_KNOWN_COOLDOWNS] === "object"
    ? stored[CACHE_KEYS.LAST_KNOWN_COOLDOWNS]
    : null;
  lastKnownProgression = stored[CACHE_KEYS.LAST_KNOWN_PROGRESSION] && typeof stored[CACHE_KEYS.LAST_KNOWN_PROGRESSION] === "object"
    ? stored[CACHE_KEYS.LAST_KNOWN_PROGRESSION]
    : null;
  cacheLoaded = true;
}

async function saveCachedSnapshot() {
  await chrome.storage.local.set({
    [CACHE_KEYS.LAST_KNOWN_PLAYER]: lastKnownPlayer || "",
    [CACHE_KEYS.LAST_KNOWN_COOLDOWNS]: lastKnownCooldowns || null,
    [CACHE_KEYS.LAST_KNOWN_PROGRESSION]: lastKnownProgression || null,
  });
}

function detectGame() {
  const host = window.location.hostname.toLowerCase();
  if (host.includes("barafranca")) {
    return "nl";
  }

  if (host.includes("omerta")) {
    return "en";
  }

  return "";
}

function tryGetOmertaNick() {
  try {
    if (
      window.omerta &&
      window.omerta.character &&
      window.omerta.character.info &&
      typeof window.omerta.character.info.name === "function"
    ) {
      const name = trimToString(window.omerta.character.info.name());
      if (name) {
        return name;
      }
    }
  } catch (_error) {
    // Ignore direct page object access failures.
  }

  return "";
}

function decodeNickFromHref(href) {
  if (!href) {
    return "";
  }

  try {
    const url = new URL(href, window.location.origin);
    if (!url.pathname.includes("/user.php")) {
      return "";
    }

    return trimToString(url.searchParams.get("nick"));
  } catch (_error) {
    return "";
  }
}

function findNickLinkInDocument(doc) {
  const links = Array.from(doc.querySelectorAll('a[href*="/user.php?nick="]'));
  for (const link of links) {
    const nick = decodeNickFromHref(link.getAttribute("href"));
    if (nick) {
      return nick;
    }
  }

  return "";
}

function findNickFromProfileClass(doc) {
  const links = Array.from(doc.querySelectorAll(".name"));
  for (const element of links) {
    if (element.tagName.toLowerCase() === "a") {
      const nick = decodeNickFromHref(element.getAttribute("href"));
      if (nick) {
        return nick;
      }
    }

    const nestedLink = element.querySelector('a[href*="/user.php?nick="]');
    if (nestedLink) {
      const nick = decodeNickFromHref(nestedLink.getAttribute("href"));
      if (nick) {
        return nick;
      }
    }
  }

  return "";
}

function resolvePlayerName(manualAlias) {
  const fromCurrentPageLink = findNickLinkInDocument(document);
  if (fromCurrentPageLink) {
    return fromCurrentPageLink;
  }

  const fromProfileClass = findNickFromProfileClass(document);
  if (fromProfileClass) {
    return fromProfileClass;
  }

  if (manualAlias) {
    return manualAlias;
  }

  const fromWindowObject = tryGetOmertaNick();
  if (fromWindowObject) {
    return fromWindowObject;
  }

  if (lastKnownPlayer) {
    return lastKnownPlayer;
  }

  return "";
}

function resolvePlayerNameFromDocument(doc, manualAlias) {
  const fromDocumentLink = findNickLinkInDocument(doc);
  if (fromDocumentLink) {
    return fromDocumentLink;
  }

  const fromProfileClass = findNickFromProfileClass(doc);
  if (fromProfileClass) {
    return fromProfileClass;
  }

  if (manualAlias) {
    return manualAlias;
  }

  const fromWindowObject = tryGetOmertaNick();
  if (fromWindowObject) {
    return fromWindowObject;
  }

  if (lastKnownPlayer) {
    return lastKnownPlayer;
  }

  return "";
}

function extractRowLabel(row) {
  const cells = row.querySelectorAll("td");
  return cells.length >= 1 ? cells[0].textContent || "" : "";
}

function extractValueCell(row) {
  const cells = row.querySelectorAll("td");
  if (cells.length < 2) {
    return null;
  }

  return cells[1];
}

function parseCooldownValue(valueCell) {
  if (!valueCell) {
    return null;
  }

  const timeEndElement = valueCell.querySelector("span[data-time-end]");
  if (timeEndElement) {
    const raw = Number(timeEndElement.getAttribute("data-time-end"));
    if (Number.isFinite(raw)) {
      return {
        timeEnd: raw,
        ready: false,
      };
    }
  }

  const valueText = normalizeText(valueCell.textContent);
  if (valueText.includes("nu") || valueText.includes("now") || valueText.includes("ready")) {
    return {
      timeEnd: 0,
      ready: true,
    };
  }

  return null;
}

function findWaitingTableInDocument(doc) {
  const tables = Array.from(doc.querySelectorAll("table.thinline"));

  for (const table of tables) {
    const header = table.querySelector(".tableheader");
    const headerText = normalizeText(header ? header.textContent : table.textContent);
    if (
      headerText.includes("wachttijden") ||
      headerText.includes("waiting times")
    ) {
      return table;
    }
  }

  return null;
}

async function waitForWaitingTableInDocument(doc) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const table = findWaitingTableInDocument(doc);
    if (table) {
      return table;
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, 500);
    });
  }

  console.warn("[Omerta] Waiting table not found after retries");
  return null;
}

function parseCooldownsFromTable(table) {
  if (!table) {
    return {
      cooldowns: {},
      parserError: "Waiting table not found after retries.",
    };
  }

  const cooldowns = {};
  const rows = Array.from(table.querySelectorAll("tr"));

  for (const row of rows) {
    const originalLabel = trimToString(extractRowLabel(row));
    if (!originalLabel) {
      continue;
    }

    const key = matchCooldownKey(originalLabel);
    if (!key) {
      continue;
    }

    const parsedValue = parseCooldownValue(extractValueCell(row));
    if (!parsedValue) {
      continue;
    }

    cooldowns[key] = {
      label: originalLabel,
      timeEnd: parsedValue.timeEnd,
      ready: parsedValue.ready,
    };
  }
  return {
    cooldowns,
    parserError: Object.keys(cooldowns).length === 0 ? "Cooldowns object is empty." : "",
  };
}

function matchesAnyAlias(labelText, aliases) {
  const normalizedLabel = normalizeText(labelText);
  if (!normalizedLabel) {
    return false;
  }

  return aliases.some((alias) => {
    const normalizedAlias = normalizeText(alias);
    return (
      normalizedLabel === normalizedAlias ||
      normalizedLabel.includes(normalizedAlias) ||
      normalizedAlias.includes(normalizedLabel)
    );
  });
}

function findProfileTableInDocument(doc) {
  const tables = Array.from(doc.querySelectorAll("table.thinline"));

  for (const table of tables) {
    const header = table.querySelector(".tableheader");
    const headerText = normalizeText(header ? header.textContent : "");
    if (!headerText) {
      continue;
    }

    if (matchesAnyAlias(headerText, PROFILE_TABLE_HEADERS)) {
      return table;
    }
  }

  return null;
}

function findRowValueByAliases(table, aliases) {
  if (!table) {
    return "";
  }

  const rows = Array.from(table.querySelectorAll("tr"));

  for (const row of rows) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 2) {
      continue;
    }

    const labelText = trimToString(cells[0].textContent);
    if (!matchesAnyAlias(labelText, aliases)) {
      continue;
    }

    const rawValueText = trimToString(cells[1].innerText || cells[1].textContent);
    const valueText = rawValueText.replace(/\s+/g, " ");
    if (valueText) {
      return valueText;
    }
  }

  return "";
}

function findRowTextByAliases(table, aliases) {
  if (!table) {
    return "";
  }

  const rows = Array.from(table.querySelectorAll("tr"));

  for (const row of rows) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 1) {
      continue;
    }

    const labelText = trimToString(cells[0].textContent);
    if (!matchesAnyAlias(labelText, aliases)) {
      continue;
    }

    return trimToString(row.innerText || row.textContent).replace(/\s+/g, " ");
  }

  return "";
}

function extractPercentValue(value) {
  const match = String(value || "").match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!match) {
    return "";
  }

  return match[1].replace(",", ".") + "%";
}

function extractProgressPercentFromCell(cell) {
  if (!cell) {
    return "";
  }

  const spanWithPercent = Array.from(cell.querySelectorAll("span")).find((element) => {
    return /\d+(?:\.\d+)?%/.test(trimToString(element.textContent));
  });
  if (spanWithPercent) {
    return extractPercentValue(spanWithPercent.textContent);
  }

  const descendants = Array.from(cell.querySelectorAll("*"));
  for (const element of descendants) {
    const text = trimToString(element.textContent);
    if (/\d+(?:\.\d+)?%/.test(text)) {
      return extractPercentValue(text);
    }
  }

  return extractPercentValue(cell.innerText || cell.textContent);
}

function parseCharacterProgressionFromDocument(doc) {
  const profileTable = findProfileTableInDocument(doc);
  const rows = profileTable ? Array.from(profileTable.querySelectorAll("tr")) : [];

  let rank = "";
  let progressionPercent = "";
  let activityPercent = "";
  let progressRow = null;

  for (const row of rows) {
    const cells = row.querySelectorAll("td");
    const rowText = trimToString(row.innerText || row.textContent).replace(/\s+/g, " ");
    if (!rowText) {
      continue;
    }

    const labelText = cells.length >= 1
      ? trimToString(cells[0].innerText || cells[0].textContent).replace(/\s+/g, " ")
      : "";

    if (!rank && cells.length >= 2 && matchesAnyAlias(labelText, PROFILE_FIELD_LABELS.rank)) {
      rank = trimToString(cells[1].innerText || cells[1].textContent).replace(/\s+/g, " ");
      continue;
    }

    if (
      !progressionPercent &&
      cells.length >= 2 &&
      !matchesAnyAlias(rowText, PROFILE_FIELD_LABELS.activity) &&
      (
        matchesAnyAlias(labelText, PROFILE_FIELD_LABELS.progression) ||
        matchesAnyAlias(rowText, PROFILE_FIELD_LABELS.progression)
      )
    ) {
      progressRow = row;
      progressionPercent = extractProgressPercentFromCell(cells[1]);
      continue;
    }

    if (
      !activityPercent &&
      (
        matchesAnyAlias(labelText, PROFILE_FIELD_LABELS.activity) ||
        matchesAnyAlias(rowText, PROFILE_FIELD_LABELS.activity)
      )
    ) {
      const activityText = cells.length >= 2
        ? trimToString(cells[1].innerText || cells[1].textContent).replace(/\s+/g, " ")
        : rowText;
      activityPercent = extractPercentValue(activityText);
    }
  }

  console.log(
    "[Omerta Progress Debug]",
    progressRow ? progressRow.outerHTML : null,
    progressionPercent,
  );

  return {
    rank,
    progressionPercent,
    activityPercent,
  };
}

async function loadInformationDocumentViaIframe() {
  if (iframeParseInFlight) {
    return null;
  }

  console.log("[Omerta] hidden iframe parse start");
  iframeParseInFlight = (async () => {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    try {
      await new Promise((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          reject(new Error("Hidden iframe load timeout"));
        }, 10000);

        iframe.addEventListener("load", () => {
          clearTimeout(timeoutId);
          resolve();
        }, { once: true });

        iframe.addEventListener("error", () => {
          clearTimeout(timeoutId);
          reject(new Error("Hidden iframe load error"));
        }, { once: true });

        iframe.src = getInformationIframeUrl();
      });

      const startedAt = Date.now();
      while (Date.now() - startedAt < 10000) {
        const iframeDoc = iframe.contentDocument;
        if (iframeDoc) {
          const waitingTable = findWaitingTableInDocument(iframeDoc);
          if (waitingTable) {
            return iframeDoc;
          }
        }

        await new Promise((resolve) => {
          window.setTimeout(resolve, 500);
        });
      }

      throw new Error("Hidden iframe waiting table timeout");
    } finally {
      iframe.remove();
    }
  })();

  try {
    return await iframeParseInFlight;
  } catch (_error) {
    return null;
  } finally {
    iframeParseInFlight = null;
  }
}

function parseInformationDocument(doc, manualAlias) {
  const waitingTable = findWaitingTableInDocument(doc);
  const parsedCooldowns = parseCooldownsFromTable(waitingTable);
  const player = resolvePlayerNameFromDocument(doc, manualAlias);
  const progression = parseCharacterProgressionFromDocument(doc);

  return {
    player,
    progression,
    cooldowns: parsedCooldowns.cooldowns,
    parserError: parsedCooldowns.parserError,
  };
}

async function postUpdate(settings, payload) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (settings.familyKey) {
    headers["x-family-key"] = settings.familyKey;
  }

  const response = await fetch(settings.apiUrl.replace(/\/+$/, "") + "/api/update", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({ ok: false, error: "Invalid server response" }));
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Update request failed");
  }
}

async function postObayUpdate(settings, payload) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (settings.familyKey) {
    headers["x-family-key"] = settings.familyKey;
  }

  const response = await fetch(settings.apiUrl.replace(/\/+$/, "") + "/api/obay/update", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({ ok: false, error: "Invalid server response" }));
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Obay update request failed");
  }
}

function isVisibleElement(element) {
  return Boolean(element) && element.getClientRects().length > 0;
}

function findObayAuctionTable() {
  const tables = Array.from(document.querySelectorAll("table"));

  for (const table of tables) {
    if (!isVisibleElement(table)) {
      continue;
    }

    const rows = Array.from(table.querySelectorAll("tr"));
    for (const row of rows) {
      const headerCells = Array.from(row.querySelectorAll("th, td"));
      const headerTexts = headerCells.map((cell) => normalizeText(cell.textContent));
      const hasRequiredHeaders = (
        headerTexts.some((text) => text.includes("name")) &&
        headerTexts.some((text) => text.includes("seller")) &&
        headerTexts.some((text) => text.includes("minimum bid")) &&
        headerTexts.some((text) => text.includes("bidder")) &&
        headerTexts.some((text) => text.includes("end"))
      );

      if (hasRequiredHeaders) {
        return {
          table,
          headerRow: row,
        };
      }
    }
  }

  return null;
}

function buildObayHeaderIndexMap(headerRow) {
  const headers = headerRow ? Array.from(headerRow.querySelectorAll("th, td")) : [];
  const indices = {
    name: -1,
    seller: -1,
    minimumBid: -1,
    bidder: -1,
    endTime: -1,
  };

  headers.forEach((cell, index) => {
    const text = normalizeText(cell.textContent);
    if (indices.name === -1 && text.includes("name")) {
      indices.name = index;
    } else if (indices.seller === -1 && text.includes("seller")) {
      indices.seller = index;
    } else if (indices.minimumBid === -1 && text.includes("minimum bid")) {
      indices.minimumBid = index;
    } else if (indices.bidder === -1 && text.includes("bidder")) {
      indices.bidder = index;
    } else if (indices.endTime === -1 && text.includes("end")) {
      indices.endTime = index;
    }
  });

  return indices;
}

function getCellText(cells, index) {
  if (index < 0 || index >= cells.length) {
    return "";
  }

  return trimToString(cells[index].innerText || cells[index].textContent).replace(/\s+/g, " ");
}

function parseObayItemsFromPage() {
  const result = findObayAuctionTable();
  if (!result) {
    return [];
  }

  const { table, headerRow } = result;
  const indices = buildObayHeaderIndexMap(headerRow);
  const rows = Array.from(table.querySelectorAll("tr"));
  const headerIndex = rows.indexOf(headerRow);
  const items = [];

  for (const row of rows.slice(headerIndex + 1)) {
    if (!isVisibleElement(row)) {
      continue;
    }

    const cells = Array.from(row.querySelectorAll("td"));
    if (cells.length < 5) {
      continue;
    }

    const item = {
      name: getCellText(cells, indices.name),
      seller: getCellText(cells, indices.seller),
      minimumBid: getCellText(cells, indices.minimumBid),
      bidder: getCellText(cells, indices.bidder),
      endTime: getCellText(cells, indices.endTime),
    };

    if (!item.name || !item.seller || !item.minimumBid || !item.endTime) {
      continue;
    }

    items.push(item);
  }

  return items;
}

async function sendObayUpdate(settings, player, room) {
  if (!isObayAuctionsPage()) {
    return { ok: false, skipped: true, reason: "not-obay-page" };
  }

  const items = parseObayItemsFromPage();
  const clientId = await getOrCreateClientId();
  await postObayUpdate(settings, {
    room,
    player,
    clientId,
    updatedAt: getUnixTime(),
    items,
  });

  return {
    ok: true,
    itemCount: items.length,
  };
}

async function sendCooldownUpdate(trigger) {
  await loadCachedSnapshot();
  const settings = await readSettings();
  const currentRoom = sanitizeRoom(settings.room);

  await writeStatus({
    room: currentRoom,
  });

  if (!settings.enabled) {
    return { ok: false, skipped: true, reason: "disabled" };
  }

  try {
    const obayPage = isObayAuctionsPage();
    let infoDoc = null;
    let parsedInfo = null;

    if (!obayPage) {
      infoDoc = await loadInformationDocumentViaIframe();
      if (infoDoc) {
        parsedInfo = parseInformationDocument(infoDoc, settings.manualAlias);
        console.log("[Omerta] hidden iframe information parsed");
      } else {
        console.warn("[Omerta] hidden iframe parse failed, falling back to live DOM");
      }
    }

    if (!parsedInfo && !obayPage) {
      const liveWaitingTable = await waitForWaitingTableInDocument(document);
      if (liveWaitingTable) {
        parsedInfo = parseInformationDocument(document, settings.manualAlias);
      } else {
        parsedInfo = {
          player: resolvePlayerNameFromDocument(document, settings.manualAlias),
          progression: parseCharacterProgressionFromDocument(document),
          cooldowns: {},
          parserError: "Waiting table not found after retries.",
        };
      }
    }

    const player = parsedInfo ? parsedInfo.player : resolvePlayerName(settings.manualAlias);

    if (!player) {
      const errorMessage = "Player nick not found.";
      await writeStatus({
        error: errorMessage,
        room: currentRoom,
      });
      console.warn("[Omerta Family Cooldown Room]", errorMessage);
      return { ok: false, error: errorMessage };
    }

    lastKnownPlayer = player;
    await saveCachedSnapshot();

    if (obayPage) {
      await sendObayUpdate(settings, player, currentRoom);
      if (lastKnownCooldowns) {
        await postUpdate(settings, {
          room: currentRoom,
          player,
          game: detectGame(),
          updatedAt: getUnixTime(),
          progression: cloneJsonSafe(lastKnownProgression || {}),
          cooldowns: cloneJsonSafe(lastKnownCooldowns),
        });
      }

      await writeStatus({
        player,
        updated: new Date().toISOString(),
        error: "",
        parserError: "",
        room: currentRoom,
        cooldownsCount: lastKnownCooldowns ? Object.keys(lastKnownCooldowns).length : 0,
      });

      return {
        ok: true,
        trigger,
        player,
        room: currentRoom,
        obayOnly: true,
        nextDelayMs: lastKnownCooldowns ? getNextRefreshDelayMs(lastKnownCooldowns, "") : READY_REFRESH_MS,
      };
    }

    const parsed = parsedInfo || {
      player,
      progression: lastKnownProgression || {},
      cooldowns: {},
      parserError: "Waiting table not found after retries.",
    };
    const hasParsedCooldowns = Object.keys(parsed.cooldowns).length > 0;
    const nextDelayMs = getNextRefreshDelayMs(
      hasParsedCooldowns ? parsed.cooldowns : lastKnownCooldowns,
      parsed.parserError && !lastKnownCooldowns ? parsed.parserError : "",
    );
    if (parsed.parserError) {
      await writeStatus({
        parserError: parsed.parserError,
        cooldownsCount: Object.keys(parsed.cooldowns).length,
        error: parsed.parserError,
        room: currentRoom,
      });
      console.warn("[Omerta Family Cooldown Room]", parsed.parserError);
    } else {
      await writeStatus({
        parserError: "",
        cooldownsCount: Object.keys(parsed.cooldowns).length,
      });
    }

    const clientId = await getOrCreateClientId();
    const payload = {
      room: currentRoom,
      player,
      clientId,
      game: detectGame(),
      updatedAt: getUnixTime(),
      progression: parsed.progression || {},
      cooldowns: parsed.cooldowns,
    };

    if (!hasParsedCooldowns && lastKnownCooldowns) {
      payload.cooldowns = cloneJsonSafe(lastKnownCooldowns);
      payload.progression = cloneJsonSafe(lastKnownProgression || parsed.progression || {});
    }

    await postUpdate(settings, payload);
    if (Object.keys(payload.cooldowns).length > 0) {
      lastKnownCooldowns = cloneJsonSafe(payload.cooldowns);
      lastKnownProgression = cloneJsonSafe(payload.progression);
      await saveCachedSnapshot();
    }

    await writeStatus({
      player,
      updated: new Date().toISOString(),
      error: parsed.parserError || "",
      parserError: parsed.parserError || "",
      room: currentRoom,
      cooldownsCount: Object.keys(payload.cooldowns).length,
    });

    return {
      ok: true,
      trigger,
      player,
      room: currentRoom,
      cooldownCount: Object.keys(payload.cooldowns).length,
      nextDelayMs,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await writeStatus({
      error: errorMessage,
      room: currentRoom,
    });
    console.warn("[Omerta Family Cooldown Room]", errorMessage);
    return { ok: false, error: errorMessage, nextDelayMs: PARSE_RETRY_MS };
  }
}

async function pollOnce(trigger) {
  if (isPolling) {
    return { ok: false, skipped: true, reason: "busy" };
  }

  isPolling = true;
  try {
    return await sendCooldownUpdate(trigger);
  } finally {
    isPolling = false;
  }
}

async function scheduleNextPoll(delayMs) {
  const settings = await readSettings();

  if (pollTimerId) {
    clearTimeout(pollTimerId);
    pollTimerId = null;
  }

  if (!settings.enabled) {
    return;
  }

  const intervalMs = Math.max(MIN_REFRESH_MS, Number(delayMs) || READY_REFRESH_MS);
  console.log("[Omerta] Next refresh scheduled in", Math.ceil(intervalMs / 1000), "seconds");
  pollTimerId = window.setTimeout(async () => {
    const result = await pollOnce("interval");
    scheduleNextPoll(result && result.nextDelayMs);
  }, intervalMs);
}

async function startPolling() {
  const settings = await readSettings();
  await writeStatus({
    room: sanitizeRoom(settings.room),
  });

  if (!settings.enabled) {
    return;
  }

  const result = await pollOnce("startup");
  scheduleNextPoll(result && result.nextDelayMs);
}

if (!isDashboard) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "SEND_NOW") {
      return;
    }

    pollOnce("popup").then((result) => {
      scheduleNextPoll(result && result.nextDelayMs);
      sendResponse(result);
    });
    return true;
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    const interestingKeys = [
      "API_URL",
      "ROOM",
      "FAMILY_KEY",
      "MANUAL_ALIAS",
      "ENABLED",
      "POLL_INTERVAL_MS",
      "apiUrl",
      "room",
      "familyKey",
      "manualAlias",
      "enabled",
      "pollIntervalMs",
    ];

    if (interestingKeys.some((key) => Object.prototype.hasOwnProperty.call(changes, key))) {
      scheduleNextPoll(MIN_REFRESH_MS);
    }
  });

  startPolling();
} else {
  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;

    const data = event.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "OMERTA_GET_IDENTITY") {
      const stored = await chrome.storage.local.get({
        LAST_PLAYER: "",
        lastDetectedPlayer: "",
        ROOM: "TestRoom",
        room: "TestRoom",
      });
      const player = stored.LAST_PLAYER || stored.lastDetectedPlayer || "";
      const room = stored.ROOM || stored.room || "TestRoom";
      const clientId = await getOrCreateClientId();
      window.postMessage({
        type: "OMERTA_IDENTITY",
        connected: Boolean(player),
        player,
        clientId,
        room
      }, "*");
    } else if (data.type === "OMERTA_SEND_CHAT") {
      try {
        const stored = await chrome.storage.local.get({
          LAST_PLAYER: "",
          lastDetectedPlayer: "",
          API_URL: "http://localhost:3000",
          apiUrl: "http://localhost:3000",
          ROOM: "TestRoom",
          room: "TestRoom",
        });
        const player = stored.LAST_PLAYER || stored.lastDetectedPlayer || "";
        const apiUrl = stored.API_URL || stored.apiUrl || "http://localhost:3000";
        const room = stored.ROOM || stored.room || "TestRoom";
        const clientId = await getOrCreateClientId();

        if (!player) {
          window.postMessage({
            type: "OMERTA_CHAT_ERROR",
            error: "Connect first: player name not detected."
          }, "*");
          return;
        }

        const response = await fetch(apiUrl.replace(/\/+$/, "") + "/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            room,
            player,
            clientId,
            message: data.message
          })
        });

        const resData = await response.json().catch(() => ({ ok: false, error: "Invalid response" }));
        if (!response.ok || !resData.ok) {
          throw new Error(resData.error || "Message send failed");
        }

        window.postMessage({ type: "OMERTA_CHAT_SENT", ok: true }, "*");
      } catch (error) {
        window.postMessage({
          type: "OMERTA_CHAT_ERROR",
          error: error.message
        }, "*");
      }
    } else if (data.type === "OMERTA_SET_ROOM") {
      try {
        const roomName = String(data.room || "").trim();
        if (roomName && /^[A-Za-z0-9_-]{1,32}$/.test(roomName)) {
          await chrome.storage.local.set({
            ROOM: roomName,
            room: roomName
          });
        }
      } catch (err) {
        console.warn("[Omerta Extension] Failed to save active room", err);
      }
    }
  });
}
