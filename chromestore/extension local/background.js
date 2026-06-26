// Keep-alive alarms
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("bgKeepAlive", { periodInMinutes: 2 });
  // Reinject content.js into already-open game tabs after extension reload
  chrome.tabs.query({ url: OMERTA_TAB_PATTERNS }, (tabs) => {
    (tabs || []).forEach(tab => {
      chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ["content.js"] }).catch(() => {});
    });
  });
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.get("bgKeepAlive", (a) => {
    if (!a) chrome.alarms.create("bgKeepAlive", { periodInMinutes: 2 });
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== "bgKeepAlive") return;
  chrome.tabs.query({ url: OMERTA_TAB_PATTERNS }, (tabs) => {
    (tabs || []).forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { type: "SEND_NOW" }).catch(() => {});
    });
  });
});

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

// ─── Message Handlers ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) return;

  if (message.type === "OMERTA_CONNECT_ALL") {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ url: OMERTA_TAB_PATTERNS });
        const validTabs = (tabs || []).filter((tab) => typeof tab.id === "number");
        if (validTabs.length === 0) {
          sendResponse({ ok: false, error: "No open Omerta tab found." });
          return;
        }
        await Promise.all(validTabs.map((tab) => chrome.tabs.reload(tab.id)));
        sendResponse({ ok: true, count: validTabs.length });
      } catch (error) {
        sendResponse({ ok: false, error: error && error.message ? error.message : "Connect failed." });
      }
    })();
    return true;
  }

  if (message.type === "FETCH_GAME_MODULE") {
    (async () => {
      try {
        const { url, domain } = message;
        const tabs = await chrome.tabs.query({ url: OMERTA_TAB_PATTERNS });
        const gameTab = tabs.find(t => t.url && t.url.includes(domain));
        if (!gameTab) { sendResponse({ ok: false, error: "no_game_tab" }); return; }
        try {
          const result = await chrome.tabs.sendMessage(gameTab.id, { type: "FETCH_GAME_MODULE", url });
          sendResponse(result || { ok: false, error: "no_response" });
        } catch (err) {
          sendResponse({ ok: false, error: err && err.message ? err.message : "tab_message_failed" });
        }
      } catch (error) {
        sendResponse({ ok: false, error: error && error.message ? error.message : "fetch_routing_failed" });
      }
    })();
    return true;
  }

  if (message.type === "OMERTA_SEND_NOW_ALL") {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ url: OMERTA_TAB_PATTERNS });
        const validTabs = (tabs || []).filter((tab) => typeof tab.id === "number");
        if (validTabs.length === 0) {
          sendResponse({ ok: false, error: "No open Omerta tab found." });
          return;
        }
        await Promise.all(
          validTabs.map(async (tab) => {
            try {
              await chrome.tabs.sendMessage(tab.id, { type: "SEND_NOW" });
            } catch (_e) {
              try { await chrome.tabs.reload(tab.id); } catch (_r) { }
            }
          })
        );
        sendResponse({ ok: true, count: validTabs.length });
      } catch (error) {
        sendResponse({ ok: false, error: error && error.message ? error.message : "Send failed." });
      }
    })();
    return true;
  }

});