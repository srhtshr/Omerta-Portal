window.addEventListener("message", function(e) {
  if (e.origin !== location.origin) return;

  if (e.data && e.data.type === "OMERTA_OPEN_POPUP") {
    chrome.runtime.sendMessage({
      type: "OPEN_GAME_POPUP",
      url: e.data.url,
      width: e.data.width,
      height: e.data.height
    }, function(resp) {
      if (resp) window.postMessage({ type: "OMERTA_POPUP_INFO", resp: resp }, "*");
    });
  }

  if (e.data && e.data.type === "OMERTA_GET_POPUP_INFO") {
    chrome.runtime.sendMessage({ type: "GET_POPUP_INFO" }, function(resp) {
      window.postMessage({ type: "OMERTA_POPUP_INFO", resp: resp }, "*");
    });
  }

  if (e.data && e.data.type === "OMERTA_CLOSE_POPUP") {
    chrome.runtime.sendMessage({ type: "CLOSE_GAME_POPUP" }, function(resp) {
      window.postMessage({ type: "OMERTA_POPUP_CLOSED" }, "*");
    });
  }
});
