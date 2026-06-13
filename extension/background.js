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
  if (!message || message.type !== "OMERTA_CONNECT_ALL") {
    return;
  }

  (async () => {
    try {
      const tabs = await chrome.tabs.query({ url: OMERTA_TAB_PATTERNS });
      const validTabs = (tabs || []).filter((tab) => typeof tab.id === "number");
      if (validTabs.length === 0) {
        sendResponse({ ok: false, error: "No open Omerta tab found." });
        return;
      }

      await Promise.all(
        validTabs.map((tab) => chrome.tabs.reload(tab.id))
      );

      sendResponse({ ok: true, count: validTabs.length });
    } catch (error) {
      sendResponse({ ok: false, error: error && error.message ? error.message : "Connect failed." });
    }
  })();

  return true;
});
