/** 在 www.douyin.com 注入：解析当前页，并响应 background 的 PARSE_NOW */

(function () {
  const parserUrl = chrome.runtime.getURL("src/content/parser.js");

  async function loadParser() {
    return import(parserUrl);
  }

  function isUserPage(url) {
    return /douyin\.com\/user\/[A-Za-z0-9_\-]+/.test(url);
  }

  async function parseAndReport(reason) {
    const parser = await loadParser();
    const url = location.href;

    if (isUserPage(url)) {
      const profile = parser.parseUserPage(document, url);
      if (profile.sec_uid) {
        chrome.runtime.sendMessage({ type: "PROFILE_PARSED", reason, profile });
        return profile;
      }
    }

    if (
      url.includes("following") ||
      document.querySelector('[data-e2e*="follow"]')
    ) {
      const creators = parser.parseFollowingList(document, url);
      if (creators.length) {
        chrome.runtime.sendMessage({ type: "FOLLOWING_PARSED", reason, creators });
        return { type: "following", creators };
      }
    }
    return null;
  }

  function scheduleParse(reason, delays = [800, 2200, 4500]) {
    delays.forEach((ms) => {
      setTimeout(() => {
        parseAndReport(reason).catch(() => {});
      }, ms);
    });
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "PARSE_NOW") {
      parseAndReport(msg.reason || "manual")
        .then((result) => sendResponse({ ok: true, result }))
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true;
    }
    if (msg?.type === "PING") {
      sendResponse({ ok: true, url: location.href });
      return false;
    }
    return false;
  });

  scheduleParse("page-load");

  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      scheduleParse("spa-nav");
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
