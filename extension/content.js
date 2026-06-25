const DASHBOARD_HOSTS = [
  "localhost:3000",
  "127.0.0.1:3000",
  "omerta-portal.onrender.com",
  "omertaportal.com"
];

const DEFAULT_API_URL = "https://omerta-portal.onrender.com";

const isDashboard = DASHBOARD_HOSTS.some(host =>
  window.location.origin.includes(host)
) || !!document.getElementById("nicknamePlayerTR");

const SERVER_PROFILES = [
  {
    serverId: "nl",
    displayName: "nl",
    parserType: "omerta",
    language: "nl",
    hostPatterns: ["barafranca.nl"],
    labelAliases: {
      crime: ["Volgende misdaadpoging", "Next crime attempt", "Bir Sonraki Suc Girisimi", "Próximo Crime"],
      car: ["Volgende autojatpoging", "Next car attempt", "Next car stealing attempt", "Bir Sonraki Araba Calma", "Próximo Assalto a Carro"],
      heist: ["Volgende heist", "Next heist", "Bir sonraki E5 Baskini", "Próximo Heist"],
      organizedCrime: ["Volgende georganiseerde misdaad", "Next organised crime", "Next organized crime", "Bir Sonraki Organize Suc", "Próximo OC"],
      megaOrganizedCrime: ["Volgende mega georganiseerde misdaad", "Next mega organised crime", "Next mega organized crime", "Bir Sonraki Mega Organize Suc", "Próximo Mega OC"],
      flight: ["Volgende vlucht", "Next flight", "Bir Sonraki Ucus", "Próxima Viagem"],
      bullets: ["Volgende kogeltransactie", "Next bullet deal", "Next bullet transaction", "Bir Sonraki Mermi Satin Alma", "Próxima Compra de Bala"],
      assassination: ["Volgende moordpoging", "Next kill attempt", "Next assassination attempt", "Bir Sonraki Cinayet", "Próximo Assassínio"],
      race: ["Volgende autorace", "Next car race", "Bir Sonraki Araba Yarisi", "Próxima Corrida"],
      blood: ["Volgende bloedtransfusie", "Next blood buy", "Next blood transfusion", "Bir Sonraki Kan Alisi", "Próxima Compra de Sangue"],
      spot: ["Volgende spot overval", "Next spot raid", "Bir Sonraki Spot Baskini", "Próximo Assalto a Spot"],
      alcohol: ["Drank", "Booze", "Alcohol", "Alkollu icki", "Estatuto com Álcool"],
      drugs: ["Drugs", "Narcs", "Drugs", "Narkotik", "Estatuto com Narcóticos"],
      rank: ["Rang", "Rank", "Seviye", "Estatuto"],
      progression: ["Rang progressie", "Rangvordering", "Rank progress", "Rank progression", "Progress to next rank", "Seviye Ilerlemesi", "Progresso no estatuto"],
      activity: ["Activiteit", "Activity"],
      bullets_field: ["Kogels"],
      money: ["Contant geld"],
      bank: ["Bankgeld"]
    }
  },
  {
    serverId: "pt",
    displayName: "pt",
    parserType: "omerta",
    language: "pt",
    hostPatterns: ["omerta.pt", "barafranca.pt"],
    labelAliases: {
      crime: ["Próximo Crime", "Next crime attempt", "Bir Sonraki Suc Girisimi"],
      car: ["Próximo Assalto a Carro", "Next car attempt", "Next car stealing attempt", "Bir Sonraki Araba Calma"],
      heist: ["Próximo Heist", "Next heist", "Bir sonraki E5 Baskini"],
      organizedCrime: ["Próximo OC", "Next organised crime", "Next organized crime", "Bir Sonraki Organize Suc"],
      megaOrganizedCrime: ["Próximo Mega OC", "Next mega organised crime", "Next mega organized crime", "Bir Sonraki Mega Organize Suc"],
      flight: ["Próxima Viagem", "Next flight", "Bir Sonraki Ucus"],
      bullets: ["Próxima Compra de Bala", "Next bullet deal", "Next bullet transaction", "Bir Sonraki Mermi Satin Alma"],
      assassination: ["Próximo Assassínio", "Next kill attempt", "Next assassination attempt", "Bir Sonraki Cinayet"],
      race: ["Próxima Corrida", "Next car race", "Bir Sonraki Araba Yarisi"],
      blood: ["Próxima Compra de Sangue", "Next blood buy", "Next blood transfusion", "Bir Sonraki Kan Alisi"],
      spot: ["Próximo Assalto a Spot", "Next spot raid", "Bir Sonraki Spot Baskini"],
      alcohol: ["Estatuto com Álcool", "Booze", "Alcohol", "Alkollu icki", "Drank"],
      drugs: ["Estatuto com Narcóticos", "Narcs", "Drugs", "Narkotik", "Drugs"],
      rank: ["Estatuto", "Informação de estatuto", "Informação do estatuto", "Informações do estatuto", "Rank", "Rang", "Seviye"],
      progression: ["Progresso no estatuto", "Rank progress", "Rank progression", "Progress to next rank", "Rangvordering", "Rang progressie", "Seviye Ilerlemesi"],
      activity: ["Saúde", "Activity", "Activiteit"],
      bullets_field: ["Balas"],
      money: ["Dinheiro"],
      bank: ["Na conta bancária"]
    }
  },
  {
    serverId: "tr",
    displayName: "tr",
    parserType: "omerta",
    language: "tr",
    hostPatterns: ["omerta.com.tr", "barafranca.com.tr", "barafranca.tr"],
    labelAliases: {
      crime: ["Bir Sonraki Suc Girisimi", "Bir Sonraki Suç Girişimi", "Next crime attempt", "Próximo Crime", "Sıradaki suç denemesi", "Sıradaki suç"],
      car: ["Bir Sonraki Araba Calma", "Bir Sonraki Araba Çalma", "Next car attempt", "Next car stealing attempt", "Próximo Assalto a Carro", "Sıradaki araba çalma denemesi", "Sıradaki araba çalma"],
      heist: ["Bir sonraki E5 Baskini", "Bir sonraki E5 Baskını", "Next heist", "Próximo Heist", "Sıradaki soygun"],
      organizedCrime: ["Bir Sonraki Organize Suc", "Bir Sonraki Organize Suç", "Next organised crime", "Next organized crime", "Próximo OC", "Sıradaki organize suç"],
      megaOrganizedCrime: ["Bir Sonraki Mega Organize Suc", "Bir Sonraki Mega Organize Suç", "Next mega organised crime", "Next mega organized crime", "Próximo Mega OC", "Sıradaki mega organize suç"],
      flight: ["Bir Sonraki Ucus", "Bir Sonraki Uçuş", "Next flight", "Próxima Viagem", "Sıradaki uçuş", "Sıradaki seyahat"],
      bullets: ["Bir Sonraki Mermi Satin Alma", "Bir Sonraki Mermi Satın Alma", "Next bullet deal", "Next bullet transaction", "Próxima Compra de Bala", "Sıradaki mermi satın alımı", "Sıradaki mermi alımı"],
      assassination: ["Bir Sonraki Cinayet", "Next kill attempt", "Next assassination attempt", "Próximo Assassínio", "Sıradaki cinayet denemesi", "Sıradaki suikast denemesi"],
      race: ["Bir Sonraki Araba Yarisi", "Bir Sonraki Araba Yarışı", "Next car race", "Próxima Corrida", "Sıradaki araba yarışı"],
      blood: ["Bir Sonraki Kan Alisi", "Bir Sonraki Kan Alışı", "Next blood buy", "Next blood transfusion", "Próxima Compra de Sangue"],
      spot: ["Bir Sonraki Spot Baskini", "Bir Sonraki Spot Baskını", "Next spot raid", "Próximo Assalto a Spot"],
      alcohol: ["Alkollu icki", "Alkollü içki", "Booze", "Alcohol", "Estatuto com Álcool", "Drank"],
      drugs: ["Narkotik", "Narcs", "Drugs", "Estatuto com Narcóticos"],
      rank: ["Seviye", "Rütbe", "Rank", "Rang", "Estatuto"],
      progression: ["Seviye Ilerlemesi", "Seviye İlerlemesi", "Rütbe ilerlemesi", "Rütbe gelişi", "Rank progress", "Rank progression", "Progress to next rank", "Rangvordering", "Rang progressie", "Progresso no estatuto"],
      activity: ["Aktivite", "Sağlık", "Activity", "Activiteit"],
      bullets_field: ["Mermi", "Mermiler"],
      money: ["Para", "Nakit"],
      bank: ["Banka", "Bankadaki para", "Banka Hesabi", "Banka hesabi"],
      health: ["Saglik", "Sağlık", "Saglık", "Saglik:"],
      prisonEscape: ["Hapisten Kacirma/Total Attempts", "Hapisten Kaçırma/Total Attempts"],
      crimeAttempts: ["Suc Girisimleri", "Suç Girişimleri"],
      carTheftAttempts: ["Araba Calma Girisimleri", "Araba Çalma Girişimleri"],
      wonRaces: ["Kazanilmis Araba Yarislari", "Kazanılmış Araba Yarışları"],
      murders: ["Cinayetler"],
      bulletsSpent: ["Geri Saldirida Harcanan Mermi", "Geri Saldırıda Harcanan Mermi"]
    }
  },
  {
    serverId: "com",
    displayName: "com",
    parserType: "omerta",
    language: "en",
    hostPatterns: ["barafranca.com", "omerta.dm"],
    labelAliases: {
      crime: ["Next crime attempt", "Bir Sonraki Suc Girisimi", "Próximo Crime"],
      car: ["Next car attempt", "Next car stealing attempt", "Bir Sonraki Araba Calma", "Próximo Assalto a Carro"],
      heist: ["Next heist", "Bir sonraki E5 Baskini", "Próximo Heist"],
      organizedCrime: ["Next organised crime", "Next organized crime", "Bir Sonraki Organize Suc", "Próximo OC"],
      megaOrganizedCrime: ["Next mega organised crime", "Next mega organized crime", "Bir Sonraki Mega Organize Suc", "Próximo Mega OC"],
      flight: ["Next flight", "Bir Sonraki Ucus", "Próxima Viagem"],
      bullets: ["Next bullet deal", "Next bullet transaction", "Bir Sonraki Mermi Satin Alma", "Próxima Compra de Bala"],
      assassination: ["Next kill attempt", "Next assassination attempt", "Bir Sonraki Cinayet", "Próximo Assassínio"],
      race: ["Next car race", "Bir Sonraki Araba Yarisi", "Próxima Corrida"],
      blood: ["Next blood buy", "Next blood transfusion", "Bir Sonraki Kan Alisi", "Próxima Compra de Sangue"],
      spot: ["Next spot raid", "Bir Sonraki Spot Baskini", "Próximo Assalto a Spot"],
      alcohol: ["Booze", "Alcohol", "Alkollu icki", "Estatuto com Álcool", "Drank"],
      drugs: ["Narcs", "Drugs", "Narkotik", "Estatuto com Narcóticos"],
      rank: ["Rank", "Rang", "Seviye", "Estatuto"],
      progression: ["Rank progress", "Rank progression", "Progress to next rank", "Rangvordering", "Rang progressie", "Seviye Ilerlemesi", "Progresso no estatuto"],
      activity: ["Activity", "Activiteit"],
      bullets_field: ["Bullets"],
      money: ["Money"],
      bank: ["Bank"]
    }
  }
];

function detectServerProfile() {
  const host = window.location.hostname.toLowerCase();
  for (const profile of SERVER_PROFILES) {
    if (profile.hostPatterns.some(pattern => host === pattern || host.endsWith("." + pattern))) {
      return profile;
    }
  }
  return SERVER_PROFILES[0];
}


async function getOrCreateClientId() {
  // Try sync storage first (persists across browser reinstalls when signed into Chrome)
  let synced = await chrome.storage.sync.get("CLIENT_ID").catch(() => ({}));
  if (synced.CLIENT_ID) {
    // Backfill local so other code reading local also finds it
    await chrome.storage.local.set({ CLIENT_ID: synced.CLIENT_ID }).catch(() => { });
    return synced.CLIENT_ID;
  }
  // Fall back to local (migrate existing local ID to sync)
  let local = await chrome.storage.local.get("CLIENT_ID");
  if (local.CLIENT_ID) {
    await chrome.storage.sync.set({ CLIENT_ID: local.CLIENT_ID }).catch(() => { });
    return local.CLIENT_ID;
  }
  // Create new ID, store in both
  const newId = "client_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  await chrome.storage.sync.set({ CLIENT_ID: newId }).catch(() => { });
  await chrome.storage.local.set({ CLIENT_ID: newId }).catch(() => { });
  return newId;
}

const STORAGE_DEFAULTS = {
  API_URL: DEFAULT_API_URL,
  ROOM: "General",
  FAMILY_KEY: "",
  MANUAL_ALIAS: "",
  ENABLED: true,
  POLL_INTERVAL_MS: 1000,
  apiUrl: DEFAULT_API_URL,
  room: "General",
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
  crime: [],
  car: [],
  heist: [],
  organizedCrime: [],
  megaOrganizedCrime: [],
  flight: [],
  bullets: [],
  assassination: [],
  race: [],
  blood: [],
  spot: [],
  alcohol: [],
  drugs: []
};

const PROFILE_FIELD_LABELS = {
  rank: [],
  progression: [],
  activity: [],
  bullets: [],
  money: [],
  bank: [],
  health: [],
  prisonEscape: [],
  crimeAttempts: [],
  carTheftAttempts: [],
  wonRaces: [],
  murders: [],
  bulletsSpent: []
};

for (const profile of SERVER_PROFILES) {
  if (profile.labelAliases) {
    for (const [key, aliases] of Object.entries(profile.labelAliases)) {
      if (COOLDOWN_LABELS[key]) {
        for (const alias of aliases) {
          if (!COOLDOWN_LABELS[key].includes(alias)) {
            COOLDOWN_LABELS[key].push(alias);
          }
        }
      } else if (key === "bullets_field") {
        for (const alias of aliases) {
          if (!PROFILE_FIELD_LABELS.bullets.includes(alias)) {
            PROFILE_FIELD_LABELS.bullets.push(alias);
          }
        }
      } else if (PROFILE_FIELD_LABELS[key]) {
        for (const alias of aliases) {
          if (!PROFILE_FIELD_LABELS[key].includes(alias)) {
            PROFILE_FIELD_LABELS[key].push(alias);
          }
        }
      }
    }
  }
}

const PROFILE_TABLE_HEADERS = [
  "Rank Information",
  "Rank information",
  "Rang informatie",
  "Ranginformatie",
  "Informação de estatuto",
  "Informação do estatuto",
  "Informações do estatuto",
  "Estatuto",
  "Rütbe",
  "Rütbe bilgisi"
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
  return window.location.origin + "/#/information.php";
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
    const profile = detectServerProfile();
    if (profile && profile.serverId) {
      payload[`LAST_PLAYER_${profile.serverId.toUpperCase()}`] = updates.player;
    }
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

function findNickFromProfileTable(doc) {
  const tables = Array.from(doc.querySelectorAll("table.thinline"));
  const nameLabels = [
    "status / estado",
    "status",
    "estado",
    "naam",
    "name",
    "durum",
    "isim",
    "i̇sim",
    "nome"
  ];

  for (const table of tables) {
    const rows = Array.from(table.querySelectorAll("tr"));
    for (const row of rows) {
      const cells = row.querySelectorAll("td");
      if (cells.length < 2) {
        continue;
      }

      const labelText = normalizeText(cells[0].textContent);
      if (nameLabels.includes(labelText)) {
        const link = cells[1].querySelector("a");
        if (link) {
          const nick = decodeNickFromHref(link.getAttribute("href"));
          if (nick) return nick;
          const text = trimToString(link.textContent).replace(/\s+/g, " ");
          if (text) return text;
        }

        const textVal = trimToString(cells[1].innerText || cells[1].textContent).replace(/\s+/g, " ");
        if (textVal) {
          return textVal;
        }
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

  const fromProfileTable = findNickFromProfileTable(document);
  if (fromProfileTable) {
    return fromProfileTable;
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

  const fromProfileTable = findNickFromProfileTable(doc);
  if (fromProfileTable) {
    return fromProfileTable;
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
  if (valueText.includes("nu") || valueText.includes("now") || valueText.includes("ready") || valueText.includes("agora") || valueText.includes("simdi") || valueText.includes("şimdi")) {
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
      headerText.includes("waiting times") ||
      headerText.includes("tempos de espera") ||
      headerText.includes("tempo de espera") ||
      headerText.includes("espera") ||
      headerText.includes("bekleme") ||
      headerText.includes("bekleme sureleri") ||
      headerText.includes("bekleme süreleri")
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
  const normalizedLabel = normalizeText(labelText).replace(/[:;.]/g, "").trim();
  if (!normalizedLabel) {
    return false;
  }

  return aliases.some((alias) => {
    const normalizedAlias = normalizeText(alias).replace(/[:;.]/g, "").trim();
    return normalizedLabel === normalizedAlias;
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
  const tables = Array.from(doc.querySelectorAll("table.thinline"));
  const waitingTable = findWaitingTableInDocument(doc);
  let rows = [];
  for (const table of tables) {
    if (table === waitingTable) {
      continue;
    }
    rows = rows.concat(Array.from(table.querySelectorAll("tr")));
  }

  let rank = "";
  let progressionPercent = "";
  let activityPercent = "";
  let bullets = "";
  let money = "";
  let bank = "";
  let health = "";
  let prisonEscape = "";
  let crimeAttempts = "";
  let carTheftAttempts = "";
  let wonRaces = "";
  let murders = "";
  let bulletsSpent = "";
  let platingLabel = "";
  let platingPercent = "";
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
      continue;
    }

    if (!bullets && cells.length >= 2 && matchesAnyAlias(labelText, PROFILE_FIELD_LABELS.bullets)) {
      bullets = trimToString(cells[1].innerText || cells[1].textContent).replace(/\s+/g, " ");
      continue;
    }

    if (!money && cells.length >= 2 && matchesAnyAlias(labelText, PROFILE_FIELD_LABELS.money)) {
      money = trimToString(cells[1].innerText || cells[1].textContent).replace(/\s+/g, " ");
      continue;
    }

    if (!health && cells.length >= 2 && matchesAnyAlias(labelText, PROFILE_FIELD_LABELS.health)) {
      health = trimToString(cells[1].innerText || cells[1].textContent).replace(/\s+/g, " ");
      continue;
    }

    if (!prisonEscape && cells.length >= 2 && matchesAnyAlias(labelText, PROFILE_FIELD_LABELS.prisonEscape)) {
      prisonEscape = trimToString(cells[1].innerText || cells[1].textContent).replace(/\s+/g, " ");
      continue;
    }
    if (!crimeAttempts && cells.length >= 2 && matchesAnyAlias(labelText, PROFILE_FIELD_LABELS.crimeAttempts)) {
      crimeAttempts = trimToString(cells[1].innerText || cells[1].textContent).replace(/\s+/g, " ");
      continue;
    }
    if (!carTheftAttempts && cells.length >= 2 && matchesAnyAlias(labelText, PROFILE_FIELD_LABELS.carTheftAttempts)) {
      carTheftAttempts = trimToString(cells[1].innerText || cells[1].textContent).replace(/\s+/g, " ");
      continue;
    }
    if (!wonRaces && cells.length >= 2 && matchesAnyAlias(labelText, PROFILE_FIELD_LABELS.wonRaces)) {
      wonRaces = trimToString(cells[1].innerText || cells[1].textContent).replace(/\s+/g, " ");
      continue;
    }
    if (!murders && cells.length >= 2 && matchesAnyAlias(labelText, PROFILE_FIELD_LABELS.murders)) {
      murders = trimToString(cells[1].innerText || cells[1].textContent).replace(/\s+/g, " ");
      continue;
    }
    if (!bulletsSpent && cells.length >= 2 && matchesAnyAlias(labelText, PROFILE_FIELD_LABELS.bulletsSpent)) {
      bulletsSpent = trimToString(cells[1].innerText || cells[1].textContent).replace(/\s+/g, " ");
      continue;
    }

    if (!bank && cells.length >= 2 && matchesAnyAlias(labelText, PROFILE_FIELD_LABELS.bank)) {
      bank = trimToString(cells[1].innerText || cells[1].textContent).replace(/\s+/g, " ");
      continue;
    }

    if (cells.length >= 2 && (labelText.toLowerCase().includes("plating") || labelText.toLowerCase().includes("plaka"))) {
      const valCell = cells[1];
      platingPercent = extractProgressPercentFromCell(valCell);

      const labelMatch = labelText.match(/(?:plating|plaka)\s*\(([^)]+)\)/i);
      if (labelMatch) {
        platingLabel = trimToString(labelMatch[1]);
      }

      if (!platingLabel) {
        if (platingPercent) {
          const num = parseFloat(platingPercent.replace("%", "").trim());
          if (!isNaN(num)) {
            if (num >= 81) platingLabel = "Very High";
            else if (num >= 61) platingLabel = "High";
            else if (num >= 41) platingLabel = "Medium";
            else if (num >= 21) platingLabel = "Low";
            else platingLabel = "Very Low";
          } else {
            platingLabel = "None";
          }
        } else {
          platingLabel = "None";
        }
      }
      continue;
    }
  }

  return {
    rank,
    progressionPercent,
    activityPercent,
    bullets,
    money,
    bank,
    health,
    prisonEscape,
    crimeAttempts,
    carTheftAttempts,
    wonRaces,
    murders,
    bulletsSpent,
    platingLabel,
    platingPercent,
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

let obayApiFetchInFlight = null;
let lastObayBackgroundFetchTime = 0;
let lastKnownTimeDiff = 0;
const OBAY_BACKGROUND_FETCH_THROTTLE_MS = 20000; // 20 seconds

function formatObayItemNameFromApi(item) {
  const type = item.type_lang || item.type || "";
  const extra = item.extra || {};

  if (type.toLowerCase() === "bodyguard") {
    const parts = [];
    if (extra.bodyguard_attack && extra.bodyguard_attack !== "0") {
      parts.push("A" + extra.bodyguard_attack);
    }
    if (extra.bodyguard_defense && extra.bodyguard_defense !== "0") {
      parts.push("D" + extra.bodyguard_defense);
    }
    if (extra.bodyguard_special && extra.bodyguard_special !== "0") {
      parts.push("S" + extra.bodyguard_special);
    }
    if (extra.bodyguard_gun && (extra.bodyguard_gun === "1" || extra.bodyguard_gun === 1)) {
      parts.push("G");
    }
    if (extra.bodyguard_vest && (extra.bodyguard_vest === "1" || extra.bodyguard_vest === 1)) {
      parts.push("V");
    }
    const suffix = parts.length > 0 ? " (" + parts.join(" | ") + ")" : "";
    return "Bodyguard: " + (extra.name || "") + suffix;
  }

  if (extra.name) {
    if (extra.name.startsWith("(")) {
      return type + " " + extra.name;
    }
    return type + ": " + extra.name;
  }

  return type;
}

function formatObayPrice(val) {
  const num = parseInt(val, 10);
  if (isNaN(num)) return val;
  return "$" + num.toLocaleString("en-US");
}

async function loadObayItemsViaApi() {
  if (obayApiFetchInFlight) {
    console.log("[Omerta Portal] obay API fetch already in flight, skipping");
    return null;
  }

  obayApiFetchInFlight = (async () => {
    const targetUrl = window.location.origin + "/?module=API.Obay&action=getData&";
    console.log("[Omerta Portal] obay API fetch start:", targetUrl);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(targetUrl, {
        credentials: "include",
        headers: {
          "X-Requested-With": "XMLHttpRequest"
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Obay API HTTP " + response.status);
      }

      const json = await response.json();
      if (!json || !json.OK || !Array.isArray(json.data)) {
        throw new Error("Obay API response not OK or data is not array");
      }

      // Calculate clock desync difference
      const serverTime = parseInt(json.time, 10);
      const localTime = Math.round(Date.now() / 1000);
      if (!isNaN(serverTime)) {
        lastKnownTimeDiff = localTime - serverTime;
        console.log("[Omerta Portal] Obay API server time synced. Desync = " + lastKnownTimeDiff + "s");
      }

      console.log("[Omerta Portal] Obay API raw items count=" + json.data.length);

      const items = json.data.map(item => {
        const name = formatObayItemNameFromApi(item);
        const seller = (item.seller && typeof item.seller === "object")
          ? (item.seller.name || "Anonymous")
          : (item.seller || "Anonymous");

        const bidsCount = parseInt(item.bids, 10) || 0;
        const priceVal = bidsCount > 0 ? item.bid_current : item.bid_start;
        const minimumBid = formatObayPrice(priceVal);

        const binVal = parseInt(item.bid_buyitnow, 10) || 0;
        const buyItNow = binVal > 0 ? formatObayPrice(item.bid_buyitnow) : "-";

        const bidder = bidsCount > 0 ? "Yes" : "-";

        // Adjust endTime by adding lastKnownTimeDiff to handle user-server clock desync
        let endTime = String(item.time_end || "");
        if (endTime && lastKnownTimeDiff !== 0) {
          const rawEndTimeNum = parseInt(endTime, 10);
          if (!isNaN(rawEndTimeNum)) {
            endTime = String(rawEndTimeNum + lastKnownTimeDiff);
          }
        }

        return {
          name,
          seller,
          minimumBid,
          buyItNow,
          bidder,
          endTime
        };
      });

      return items;
    } finally {
      clearTimeout(timeoutId);
    }
  })();

  try {
    return await obayApiFetchInFlight;
  } catch (error) {
    console.warn("[Omerta Portal] obay API fetch error:", error.message);
    return null;
  } finally {
    obayApiFetchInFlight = null;
  }
}

async function fetchObayInBackground(settings, player, room) {
  const now = Date.now();
  if (now - lastObayBackgroundFetchTime < OBAY_BACKGROUND_FETCH_THROTTLE_MS) {
    return;
  }

  lastObayBackgroundFetchTime = now;

  try {
    const profile = detectServerProfile();
    const clientId = await getOrCreateClientId();

    // Try fetching via API
    const items = await loadObayItemsViaApi();
    if (!items || items.length === 0) {
      console.log("[Omerta Portal] Background Obay fetch returned no items or failed. Skipping update.");
      return;
    }

    await postObayUpdate(settings, {
      room,
      player,
      clientId,
      updatedAt: getUnixTime(),
      items,
      serverId: profile.serverId,
      serverName: profile.displayName,
      hostname: window.location.hostname,
      nickname: player,
      timestamp: getUnixTime(),
    });
    console.log("[Omerta Portal] Background Obay updated successfully with " + items.length + " items.");
  } catch (err) {
    console.warn("[Omerta Portal] Background Obay update error:", err);
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

function fetchCityGiftActive() {
  const hasGift = !!document.getElementById("city_gift_notification");
  console.log("[CityGift] active=" + hasGift);
  return hasGift;
}

function parseMailUnreadCountFromDocument(doc) {
  const d = doc || document;
  const el = d.querySelector('a[href*="module=Mail"] .sidebar-bubble-number');
  const count = el ? parseInt(el.textContent.trim(), 10) || 0 : 0;
  console.log("[Mail] parsed count=", count);
  return count;
}

function isVisibleElement(element) {
  return Boolean(element) && element.getClientRects().length > 0;
}

function findObayAuctionTable(doc, checkVisibility = true) {
  const d = doc || document;
  const tables = Array.from(d.querySelectorAll("table"));

  for (const table of tables) {
    if (checkVisibility && !isVisibleElement(table)) {
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

function parseObayItemsFromPage(doc, checkVisibility = true) {
  const result = findObayAuctionTable(doc, checkVisibility);
  if (!result) {
    return [];
  }

  const { table, headerRow } = result;
  const indices = buildObayHeaderIndexMap(headerRow);
  const rows = Array.from(table.querySelectorAll("tr"));
  const headerIndex = rows.indexOf(headerRow);
  const items = [];

  for (const row of rows.slice(headerIndex + 1)) {
    if (checkVisibility && !isVisibleElement(row)) {
      continue;
    }

    const cells = Array.from(row.querySelectorAll("td"));
    if (cells.length < 5) {
      continue;
    }

    const timeEndSpan = cells[indices.endTime] ? cells[indices.endTime].querySelector("span[data-time-end]") : null;
    const timeEndVal = timeEndSpan ? timeEndSpan.getAttribute("data-time-end") : "";

    // Adjust scraped endTime using lastKnownTimeDiff to handle user-server clock desync
    let scrapedEndTime = timeEndVal || getCellText(cells, indices.endTime);
    if (timeEndVal && lastKnownTimeDiff !== 0) {
      const rawEndTimeNum = parseInt(timeEndVal, 10);
      if (!isNaN(rawEndTimeNum)) {
        scrapedEndTime = String(rawEndTimeNum + lastKnownTimeDiff);
      }
    }

    const minBidRaw = getCellText(cells, indices.minimumBid);
    const binMatch = minBidRaw.match(/\(\s*(\$[\d,]+)\s*\)/);
    const buyItNow = binMatch ? binMatch[1] : "-";
    const cleanMinBid = minBidRaw.replace(/\s*\(\s*\$[\d,]+\s*\)\s*$/, "").trim();

    const item = {
      name: getCellText(cells, indices.name),
      seller: getCellText(cells, indices.seller),
      minimumBid: cleanMinBid,
      buyItNow: buyItNow,
      bidder: getCellText(cells, indices.bidder),
      endTime: scrapedEndTime,
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

  // 1. Try fetching via API first to get clean, desync-adjusted data
  let items = await loadObayItemsViaApi();
  let source = "api";

  // 2. If API fails or is empty, fall back to live DOM scraping
  if (!items || items.length === 0) {
    console.log("[Omerta Portal] Live Obay API fetch failed or returned no items, falling back to DOM scraper...");
    items = parseObayItemsFromPage();
    source = "dom";
  }

  if (!items || items.length === 0) {
    return { ok: false, error: "No obay items found from API or DOM" };
  }

  const clientId = await getOrCreateClientId();
  const profile = detectServerProfile();
  await postObayUpdate(settings, {
    room,
    player,
    clientId,
    updatedAt: getUnixTime(),
    items,
    serverId: profile.serverId,
    serverName: profile.displayName,
    hostname: window.location.hostname,
    nickname: player,
    timestamp: getUnixTime(),
  });

  console.log("[Omerta Portal] Live Obay updated successfully via " + source + " with " + items.length + " items.");

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
      console.warn("[Omerta Portal]", errorMessage);
      return { ok: false, error: errorMessage };
    }

    lastKnownPlayer = player;
    await saveCachedSnapshot();

    const cityGiftActive = await fetchCityGiftActive();
    console.log("[City] payload value=", cityGiftActive);
    const mailSourceDoc = document || infoDoc;
    const mailUnreadCount = parseMailUnreadCountFromDocument(mailSourceDoc);

    if (obayPage) {
      await sendObayUpdate(settings, player, currentRoom);
      const profile = detectServerProfile();
      if (lastKnownCooldowns) {
        console.log("[Mail] payload value=", mailUnreadCount);
        await postUpdate(settings, {
          room: currentRoom,
          player,
          game: detectGame(),
          updatedAt: getUnixTime(),
          progression: cloneJsonSafe(lastKnownProgression || {}),
          cooldowns: cloneJsonSafe(lastKnownCooldowns),
          serverId: profile.serverId,
          serverName: profile.displayName,
          hostname: window.location.hostname,
          cityGiftActive,
          mailUnreadCount,
          nickname: player,
          timestamp: getUnixTime(),
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
      console.warn("[Omerta Portal]", parsed.parserError);
    } else {
      await writeStatus({
        parserError: "",
        cooldownsCount: Object.keys(parsed.cooldowns).length,
      });
    }

    const clientId = await getOrCreateClientId();
    const profile = detectServerProfile();
    const payload = {
      room: currentRoom,
      player,
      clientId,
      game: detectGame(),
      updatedAt: getUnixTime(),
      progression: parsed.progression || {},
      cooldowns: parsed.cooldowns,
      serverId: profile.serverId,
      serverName: profile.displayName,
      hostname: window.location.hostname,
      cityGiftActive,
      mailUnreadCount,
      nickname: player,
      timestamp: getUnixTime(),
    };
    console.log("[Mail] payload value=", mailUnreadCount);

    if (!hasParsedCooldowns && lastKnownCooldowns) {
      payload.cooldowns = cloneJsonSafe(lastKnownCooldowns);
      payload.progression = cloneJsonSafe(lastKnownProgression || parsed.progression || {});
    }

    await postUpdate(settings, payload);
    fetchObayInBackground(settings, player, currentRoom);
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
    console.warn("[Omerta Portal]", errorMessage);
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
  let settings;
  try {
    settings = await readSettings();
  } catch (_e) {
    return;
  }

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
    try {
      const result = await pollOnce("interval");
      scheduleNextPoll(result && result.nextDelayMs);
    } catch (_e) {
      scheduleNextPoll(null);
    }
  }, intervalMs);
}

async function startPolling() {
  let settings;
  try {
    settings = await readSettings();
  } catch (_e) {
    return;
  }
  try {
    await writeStatus({ room: sanitizeRoom(settings.room) });
  } catch (_e) { }

  if (!settings.enabled) {
    return;
  }

  try {
    const result = await pollOnce("startup");
    scheduleNextPoll(result && result.nextDelayMs);
  } catch (_e) {
    scheduleNextPoll(null);
  }
}

let gameChatPollTimer = null;
let gameChatServerTimeSent = false;

async function fetchAndPushGameChat(settings) {
  const apiBase = (settings.apiUrl || DEFAULT_API_URL).replace(/\/+$/, "");
  const profile = detectServerProfile();
  const serverId = profile ? profile.serverId : "";
  console.log("[GameChat] server profile serverId=" + serverId + " origin=" + window.location.origin);
  if (!serverId) return;

  let serverTime;
  let serverTimeSyncedAt;
  if (!gameChatServerTimeSent) {
    const clockEl = document.getElementById("omerta_clock");
    const raw = clockEl ? clockEl.textContent.trim() : "";
    if (raw) {
      serverTime = raw;
      serverTimeSyncedAt = Date.now();
    }
  }

  const endpoints = [
    { kind: "general", room: "omerta.general" },
    { kind: "crimes", room: "omerta.orgcrime" }
  ];

  try {
    const outboxRes = await fetch(apiBase + "/api/game-chat-outbox?serverId=" + serverId);
    if (outboxRes.ok) {
      const outboxData = await outboxRes.json();
      const pending = (outboxData && Array.isArray(outboxData.messages)) ? outboxData.messages : [];
      if (pending.length > 0) console.log("[GameChat] outbox pending=" + pending.length);
      for (const msg of pending) {
        const roomName = msg.kind === "crimes" ? "omerta.orgcrime" : "omerta.general";
        const params = new URLSearchParams({ room: roomName, message: msg.message });
        const chatRes = await fetch(window.location.origin + "/?module=Chat&action=send", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest" },
          body: params.toString()
        });
        const chatJson = await chatRes.json().catch(() => null);
        const ok = chatJson && chatJson.data && chatJson.data.OK;
        console.log("[GameChat] sent kind=" + msg.kind + " ok=" + ok);
      }
    }
  } catch (err) {
    console.warn("[GameChat] outbox error", err);
  }

  for (const ep of endpoints) {
    const fetchUrl = window.location.origin + "/?module=Chat&action=history&room=" + ep.room + "&page=-1";
    try {
      console.log("[GameChat] fetch start room=" + ep.room + " url=" + fetchUrl);
      const res = await fetch(fetchUrl);
      console.log("[GameChat] fetch status=" + res.status + " room=" + ep.room);
      if (!res.ok) continue;
      const data = await res.json();
      const history = (data && data.data && Array.isArray(data.data.history)) ? data.data.history : [];
      console.log("[GameChat] history count room=" + ep.room + " count=" + history.length);
      if (history.length === 0) continue;
      const postUrl = apiBase + "/api/game-chat";
      const body = { serverId, kind: ep.kind, history };
      if (serverTime) {
        body.serverTime = serverTime;
        body.serverTimeSyncedAt = serverTimeSyncedAt;
      }
      console.log("[GameChat] post start serverId=" + serverId + " kind=" + ep.kind + " count=" + history.length);
      const postRes = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      console.log("[GameChat] post status=" + postRes.status);
      if (postRes.ok && serverTime && !gameChatServerTimeSent) {
        gameChatServerTimeSent = true;
      }
    } catch (err) {
      console.warn("[GameChat] error room=" + ep.room, err);
    }
  }
}

async function runGameChatPoll() {
  try {
    const settings = await readSettings();
    if (settings.enabled) {
      await fetchAndPushGameChat(settings);
    }
  } catch (err) {
    if (isCtxInvalid(err)) return;
    console.warn("[GameChat] error in poll", err);
  }
  gameChatPollTimer = window.setTimeout(runGameChatPoll, 2000);
}

function isCtxInvalid(err) {
  const msg = (err && (err.message || String(err))) || "";
  return msg.includes("Extension context invalidated");
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
  runGameChatPoll();
} else {
  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;

    const data = event.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "OMERTA_GET_IDENTITY") {
      try {
        const reqServerId = data.serverId ? String(data.serverId).toUpperCase() : "";
        const lookupKeys = {
          LAST_PLAYER: "",
          lastDetectedPlayer: "",
          ROOM: "General",
          room: "General",
        };
        if (reqServerId) {
          lookupKeys[`LAST_PLAYER_${reqServerId}`] = "";
        }
        const stored = await chrome.storage.local.get(lookupKeys);
        let player = "";
        if (reqServerId) {
          player = stored[`LAST_PLAYER_${reqServerId}`] || "";
        } else {
          player = stored.LAST_PLAYER || stored.lastDetectedPlayer || "";
        }
        const room = stored.ROOM || stored.room || "General";
        const clientId = await getOrCreateClientId();
        window.postMessage({
          type: "OMERTA_IDENTITY",
          connected: Boolean(player),
          player,
          clientId,
          room,
          serverId: reqServerId
        }, "*");
      } catch (err) {
        if (!isCtxInvalid(err)) console.warn("[Omerta Extension] OMERTA_GET_IDENTITY error", err);
      }
    } else if (data.type === "OMERTA_SEND_CHAT") {
      try {
        const reqServerId = data.serverId ? String(data.serverId).toUpperCase() : "";
        const lookupKeys = {
          LAST_PLAYER: "",
          lastDetectedPlayer: "",
          API_URL: DEFAULT_API_URL,
          apiUrl: DEFAULT_API_URL,
          ROOM: "General",
          room: "General",
        };
        if (reqServerId) {
          lookupKeys[`LAST_PLAYER_${reqServerId}`] = "";
        }
        const stored = await chrome.storage.local.get(lookupKeys);
        let player = "";
        if (reqServerId) {
          player = stored[`LAST_PLAYER_${reqServerId}`] || "";
        } else {
          player = stored.LAST_PLAYER || stored.lastDetectedPlayer || "";
        }
        const apiUrl = stored.API_URL || stored.apiUrl || DEFAULT_API_URL;
        const room = stored.ROOM || stored.room || "General";
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
    } else if (data.type === "OMERTA_SET_PLAYER") {
      try {
        const player = String(data.player || "").trim();
        const serverId = String(data.serverId || "").trim().toUpperCase();
        if (player && serverId) {
          const updateObj = {
            LAST_PLAYER: player,
            lastDetectedPlayer: player
          };
          updateObj[`LAST_PLAYER_${serverId}`] = player;
          await chrome.storage.local.set(updateObj);
        }
      } catch (err) {
        if (!isCtxInvalid(err)) console.warn("[Omerta Extension] Failed to save active player", err);
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
    } else if (data.type === "OMERTA_CONNECT_ALL") {
      try {
        const response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type: "OMERTA_CONNECT_ALL" }, (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message || "Connect failed."));
              return;
            }
            resolve(result);
          });
        });
        if (!response || !response.ok) {
          throw new Error((response && response.error) || "Connect failed.");
        }
        window.postMessage({
          type: "OMERTA_CONNECT_RESULT",
          ok: true,
          count: Number(response.count) || 0
        }, "*");
      } catch (err) {
        window.postMessage({
          type: "OMERTA_CONNECT_RESULT",
          ok: false,
          error: err && err.message ? err.message : "Connect failed."
        }, "*");
      }
    } else if (data.type === "OMERTA_SEND_NOW_ALL") {
      try {
        const response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type: "OMERTA_SEND_NOW_ALL" }, (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message || "Send failed."));
              return;
            }
            resolve(result);
          });
        });
        window.postMessage({
          type: "OMERTA_CONNECT_RESULT",
          ok: response && response.ok,
          count: Number(response && response.count) || 0
        }, "*");
      } catch (err) {
        window.postMessage({
          type: "OMERTA_CONNECT_RESULT",
          ok: false,
          error: err && err.message ? err.message : "Send failed."
        }, "*");
      }
    }
  });
}
