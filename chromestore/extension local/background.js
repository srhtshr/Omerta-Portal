// Keep-alive alarms
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("bgKeepAlive", { periodInMinutes: 2 });
  // Reinject content.js into already-open game tabs after extension reload
  chrome.tabs.query({ url: OMERTA_TAB_PATTERNS }, (tabs) => {
    (tabs || []).forEach(tab => {
      chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ["content.js"] }).catch(() => { });
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
      chrome.tabs.sendMessage(tab.id, { type: "SEND_NOW" }).catch(() => { });
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

// ─── Game Popup ───────────────────────────────────────────────────────────────

var gamePopupWindowId = null;
var gamePopupTabId = null;

chrome.windows.onRemoved.addListener(function (windowId) {
  if (windowId === gamePopupWindowId) {
    gamePopupWindowId = null;
    gamePopupTabId = null;
  }
});

// ─── Message Handlers ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) return;

  if (message.type === "GET_POPUP_INFO") {
    if (gamePopupWindowId !== null) {
      chrome.windows.get(gamePopupWindowId, function (win) {
        if (chrome.runtime.lastError || !win) { sendResponse({ found: false }); return; }
        sendResponse({ found: true, left: win.left, top: win.top, width: win.width, height: win.height });
      });
    } else {
      sendResponse({ found: false });
    }
    return true;
  }

  if (message.type === "CLOSE_GAME_POPUP") {
    if (gamePopupWindowId !== null) {
      chrome.windows.remove(gamePopupWindowId, function() {
        gamePopupWindowId = null;
        gamePopupTabId = null;
        sendResponse({ ok: true });
      });
    } else {
      sendResponse({ ok: true });
    }
    return true;
  }

  if (message.type === "OPEN_GAME_POPUP") {
    (async () => {
      try {
        const { url, width, height } = message;
        console.log("[bg] OPEN_GAME_POPUP url=", url, "winId=", gamePopupWindowId);
        const TARGET = { width: width || 828, height: height || 671, left: 436, top: 302 };
        if (gamePopupWindowId !== null) {
          try {
            await chrome.windows.get(gamePopupWindowId);
            if (gamePopupTabId !== null) await chrome.tabs.update(gamePopupTabId, { url });
            const updated = await chrome.windows.update(gamePopupWindowId, { ...TARGET, focused: true });
            sendResponse({ ok: true, left: updated.left, top: updated.top, width: updated.width, height: updated.height });
            return;
          } catch (_e) {
            gamePopupWindowId = null;
            gamePopupTabId = null;
          }
        }
        const win = await chrome.windows.create({ url, type: "popup", ...TARGET });
        gamePopupWindowId = win.id;
        gamePopupTabId = win.tabs && win.tabs[0] ? win.tabs[0].id : null;
        await chrome.windows.update(win.id, TARGET);
        sendResponse({ ok: true, left: win.left, top: win.top, width: win.width, height: win.height });
      } catch (err) {
        console.error("[bg] OPEN_GAME_POPUP error:", err);
        sendResponse({ ok: false, error: err && err.message });
      }
    })();
    return true;
  }

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