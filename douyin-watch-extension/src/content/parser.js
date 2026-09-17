/**
 * Douyin 页面解析。
 * 若抖音改版导致解析失败，优先修改本文件。
 */

export function parseUserPage(doc = document, pageUrl = location.href) {
  const secUid = matchSecUid(pageUrl) || "";
  const nickname =
    textOf(doc, [
      '[data-e2e="user-info"] [data-e2e="user-nickname"]',
      '[data-e2e="user-nickname"]',
      'h1',
      '[class*="nickname"]',
    ]) || "";

  const avatar =
    attrOf(
      doc,
      [
        '[data-e2e="user-info"] img',
        '[data-e2e="user-avatar"] img',
        'img[class*="avatar"]',
      ],
      "src"
    ) || "";

  const videos = parseVideoCards(doc, pageUrl);

  return {
    type: "user",
    sec_uid: secUid,
    nickname,
    avatar_url: avatar,
    profile_url: secUid ? `https://www.douyin.com/user/${secUid}` : pageUrl,
    videos,
  };
}

export function parseVideoCards(doc = document, pageUrl = location.href) {
  const seen = new Set();
  const out = [];
  const anchors = [
    ...doc.querySelectorAll(
      'a[href*="/video/"], [data-e2e="user-post-list"] a[href*="/video/"]'
    ),
  ];

  for (const a of anchors) {
    const href = a.getAttribute("href") || a.href || "";
    const abs = toAbs(href, pageUrl);
    const id = matchVideoId(abs);
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const title =
      a.getAttribute("title") ||
      textOfEl(a) ||
      a.querySelector("img")?.alt ||
      "";
    const cover = a.querySelector("img")?.src || "";

    out.push({
      video_id: id,
      title: title.trim(),
      cover_url: cover,
      share_url: `https://www.douyin.com/video/${id}`,
      published_at: "",
    });
    if (out.length >= 12) break;
  }
  return out;
}

export function parseFollowingList(doc = document, pageUrl = location.href) {
  const creators = [];
  const seen = new Set();
  const links = [...doc.querySelectorAll('a[href*="/user/"]')];

  for (const a of links) {
    const href = toAbs(a.getAttribute("href") || a.href || "", pageUrl);
    const secUid = matchSecUid(href);
    if (!secUid || seen.has(secUid)) continue;
    if (href.includes("/user/self")) continue;
    seen.add(secUid);

    const nickname =
      a.getAttribute("title") ||
      textOfEl(a) ||
      a.parentElement?.querySelector('[class*="nickname"]')?.textContent ||
      "";
    const avatar = a.querySelector("img")?.src || "";

    creators.push({
      sec_uid: secUid,
      nickname: nickname.trim(),
      avatar_url: avatar,
      profile_url: `https://www.douyin.com/user/${secUid}`,
      priority: 0,
      paused: false,
    });
    if (creators.length >= 80) break;
  }
  return creators;
}

function matchSecUid(url) {
  if (!url) return null;
  const m = String(url).match(/\/user\/([A-Za-z0-9_\-]{10,})/);
  return m ? m[1] : null;
}

function matchVideoId(url) {
  if (!url) return null;
  const m = String(url).match(/\/video\/(\d{5,})/);
  return m ? m[1] : null;
}

function toAbs(href, base) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function textOf(doc, selectors) {
  for (const sel of selectors) {
    const t = doc.querySelector(sel)?.textContent?.trim();
    if (t) return t;
  }
  return "";
}

function attrOf(doc, selectors, attr) {
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    const v = el?.getAttribute?.(attr);
    if (v) return v;
  }
  return "";
}

function textOfEl(el) {
  return (el.textContent || "").replace(/\s+/g, " ").trim();
}
