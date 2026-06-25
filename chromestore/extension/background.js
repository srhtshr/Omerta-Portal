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

  if (message.type === "OMERTA_SEND_NOW_ALL") {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ url: OMERTA_TAB_PATTERNS });
        const validTabs = (tabs || []).filter((tab) => typeof tab.id === "number");
        if (validTabs.length === 0) {
          sendResponse({ ok: false, error: "No open Omerta tab found." });
          return;
        }
        // Try SEND_NOW on each tab; if no content script listener, reload that tab
        await Promise.all(
          validTabs.map(async (tab) => {
            try {
              await chrome.tabs.sendMessage(tab.id, { type: "SEND_NOW" });
            } catch (_e) {
              // Content script not ready on this tab — reload so it initializes
              try { await chrome.tabs.reload(tab.id); } catch (_r) {}
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
