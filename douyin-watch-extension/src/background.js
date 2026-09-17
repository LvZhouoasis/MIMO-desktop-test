/**
 * 后台服务：定时轮询博主主页 → 本地去重 → 直连 Server酱推送到微信。
 * 不依赖任何自建后端。
 */

import {
  extractSecUidFromUrl,
  formatTime,
  getSettings,
  setSettings,
  upsertCreatorLocal,
} from "./shared/storage.js";
import { isQuiet, sendServerChan } from "./shared/push.js";

const MONITOR_TAB_KEY = "monitorTabId";
const ALARM_POLL = "dw-poll";
const ALARM_DIGEST = "dw-digest";

chrome.runtime.onInstalled.addListener(async () => {
  await setupAlarms();
  try {
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({
      id: "dw-add-creator",
      title: "监控这个抖音博主",
      contexts: ["page", "link"],
      documentUrlPatterns: ["https://www.douyin.com/*"],
    });
  } catch {}
});

chrome.runtime.onStartup.addListener(() => {
  setupAlarms();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "dw-add-creator") {
    addFromTab(tab).catch((err) => console.warn("[dw] context add", err));
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_POLL) {
    runCheckCycle("alarm").catch((e) => console.warn("[dw] poll", e));
  }
  if (alarm.name === ALARM_DIGEST) {
    runDailyDigest().catch((e) => console.warn("[dw] digest", e));
  }
});

async function setupAlarms() {
  const s = await getSettings();
  await chrome.alarms.clear(ALARM_POLL);
  await chrome.alarms.clear(ALARM_DIGEST);
  if (!s.enabled) return;
  const period = Math.max(1, Number(s.intervalMinutes) || 2);
  chrome.alarms.create(ALARM_POLL, {
    periodInMinutes: period,
    delayInMinutes: 0.2,
  });
  // 每天检查是否到了日报时间（每 30 分钟醒一次看本地日期）
  chrome.alarms.create(ALARM_DIGEST, { periodInMinutes: 30 });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handle(msg, sender)
    .then((r) => sendResponse({ ok: true, ...r }))
    .catch((e) => sendResponse({ ok: false, error: String(e?.message || e) }));
  return true;
});

async function handle(msg, sender) {
  switch (msg?.type) {
    case "GET_STATE": {
      const settings = await getSettings();
      return { settings };
    }
    case "SAVE_SETTINGS": {
      await setSettings(msg.patch || {});
      await setupAlarms();
      return { settings: await getSettings() };
    }
    case "ADD_FROM_TAB": {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return addFromTab(tab);
    }
    case "ADD_FROM_TAB_ID": {
      const tab = await chrome.tabs.get(msg.tabId);
      return addFromTab(tab);
    }
    case "IMPORT_FOLLOWING": {
      return importFollowing();
    }
    case "RUN_CHECK": {
      return { result: await runCheckCycle("manual") };
    }
    case "TEST_PUSH": {
      const r = await sendServerChan(
        "抖音关注监控 · 测试",
        "如果你在微信里看到这条，说明推送已经配置成功。\n\n接下来去抖音打开一个博主主页，点「+ 当前页博主」即可开始监控。"
      );
      return r;
    }
    case "RUN_DIGEST": {
      const summary = await buildDigestMarkdown();
      const r = await sendServerChan(
        "抖音关注 · 手动日报",
        summary || "暂无数据"
      );
      return { push: r };
    }
    case "PROFILE_PARSED":
    case "FOLLOWING_PARSED":
      return {};
    default:
      return {};
  }
}

// ---------- 添加博主 ----------

async function addFromTab(tab) {
  if (!tab?.url || !tab.url.includes("douyin.com")) {
    throw new Error("请先打开抖音网站");
  }
  const secUid = extractSecUidFromUrl(tab.url);
  if (!secUid) {
    throw new Error("当前页不是博主主页（网址需包含 /user/...）");
  }

  let profile = null;
  try {
    const resp = await chrome.tabs.sendMessage(tab.id, {
      type: "PARSE_NOW",
      reason: "add",
    });
    if (resp?.ok && resp.result?.sec_uid) profile = resp.result;
  } catch {}

  const creator = await upsertCreatorLocal({
    sec_uid: secUid,
    nickname: profile?.nickname || "",
    avatar_url: profile?.avatar_url || "",
    profile_url: `https://www.douyin.com/user/${secUid}`,
    paused: false,
    baselineSet: false,
  });

  // 立刻抓一次做基线，避免把历史视频全当成新视频推送
  try {
    await checkOneCreator(creator, await getSettings(), { baselineOnly: true });
  } catch (e) {
    console.warn("[dw] baseline fail", e);
  }

  const fresh = (await getSettings()).creators.find((c) => c.sec_uid === secUid);
  return { creator: fresh || creator };
}

async function importFollowing() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.includes("douyin.com")) {
    throw new Error("请先打开抖音，并进入「关注」列表页");
  }
  const resp = await chrome.tabs
    .sendMessage(tab.id, { type: "PARSE_NOW", reason: "import" })
    .catch(() => null);
  const creators = resp?.result?.creators || [];
  if (!creators.length) {
    throw new Error("未解析到关注列表。请在关注页多滚动几下后再试；失败请手动打开博主主页添加。");
  }
  for (const c of creators) {
    await upsertCreatorLocal({ ...c, baselineSet: false });
  }
  return { imported: creators.length };
}

// ---------- 轮询 ----------

async function runCheckCycle(reason) {
  const settings = await getSettings();
  if (!settings.enabled) return { skipped: "disabled" };
  if (!settings.serverChanKey) return { skipped: "no-key" };

  const queue = settings.creators.filter((c) => !c.paused);
  if (!queue.length) return { skipped: "no-creators" };

  const results = [];
  const pendingBatch = [];

  for (const creator of queue) {
    try {
      const one = await checkOneCreator(creator, await getSettings(), {});
      results.push(one);
      if (one.news?.length) pendingBatch.push(one);
    } catch (err) {
      results.push({
        sec_uid: creator.sec_uid,
        ok: false,
        error: String(err.message || err),
      });
    }
    await sleep((await getSettings()).perCreatorDelayMs || 3000);
  }

  // 合并窗口：把本轮新视频合并推送，防止刷屏
  if (pendingBatch.length) {
    await flushPending(pendingBatch, settings);
  }

  await setSettings({ lastCheckAt: new Date().toISOString() });
  return { reason, checked: results.length, results };
}

async function checkOneCreator(creator, settings, opts = {}) {
  const url = creator.profile_url || `https://www.douyin.com/user/${creator.sec_uid}`;
  const tabId = await openMonitorTab(url);
  await sleep(1600);

  let profile = null;
  try {
    const resp = await chrome.tabs.sendMessage(tabId, { type: "PARSE_NOW", reason: "poll" });
    if (resp?.ok && resp.result) profile = resp.result;
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["src/content/content.js"],
      });
      await sleep(1200);
      const resp = await chrome.tabs.sendMessage(tabId, {
        type: "PARSE_NOW",
        reason: "poll-retry",
      });
      if (resp?.ok && resp.result) profile = resp.result;
    } catch (e) {
      throw new Error("页面解析失败（可能未登录抖音，或页面已改版）");
    }
  }

  const videos = profile?.videos || [];
  if (!profile?.sec_uid && !videos.length) {
    throw new Error("解析结果为空");
  }

  const nickname = profile?.nickname || creator.nickname || creator.sec_uid.slice(0, 10);
  let news = [];

  if (!creator.baselineSet || opts.baselineOnly) {
    // 首次：只记基线
    await upsertCreatorLocal({
      ...creator,
      nickname,
      avatar_url: profile?.avatar_url || creator.avatar_url,
      baselineSet: true,
      last_video_id: videos[0]?.video_id || "",
      last_checked_at: new Date().toISOString(),
    });
    return {
      sec_uid: creator.sec_uid,
      nickname,
      ok: true,
      baseline: true,
      total: videos.length,
      news: [],
    };
  }

  const lastId = creator.last_video_id;
  if (lastId && videos.length) {
    const idx = videos.findIndex((v) => v.video_id === lastId);
    if (idx > 0) news = videos.slice(0, idx);
    else if (idx === -1) {
      // 基线视频已不在首页，保守认为最新 1 条是新的
      news = videos.slice(0, 1);
    }
  }

  await upsertCreatorLocal({
    ...creator,
    nickname,
    avatar_url: profile?.avatar_url || creator.avatar_url,
    baselineSet: true,
    last_video_id: videos[0]?.video_id || lastId,
    last_checked_at: new Date().toISOString(),
  });

  return {
    sec_uid: creator.sec_uid,
    nickname,
    ok: true,
    total: videos.length,
    news,
  };
}

async function flushPending(batch, settings) {
  const quiet = isQuiet(settings);
  const lines = [];
  let count = 0;

  for (const item of batch) {
    for (const v of item.news || []) {
      count += 1;
      const title = (v.title || "（无标题）").replace(/\n/g, " ").slice(0, 40);
      const url = v.share_url || `https://www.douyin.com/video/${v.video_id}`;
      lines.push(`- [@${item.nickname}](${url}) ${title}`);
    }
  }
  if (!count) return;

  if (quiet) {
    // 静默时段不打扰，留给日报
    await setSettings({
      lastQuietNote: `${new Date().toISOString()} 静默时段捕获 ${count} 条`,
    });
    return;
  }

  if (batch.length === 1 && batch[0].news?.length === 1) {
    const item = batch[0];
    const v = item.news[0];
    const title = (v.title || "（无标题）").replace(/\n/g, " ").slice(0, 50);
    const url = v.share_url || `https://www.douyin.com/video/${v.video_id}`;
    await sendServerChan(
      `@${item.nickname} 发了新视频`,
      `**${title}**\n\n[打开视频](${url})`
    );
    return;
  }

  await sendServerChan(
    `抖音更新：${batch.length}人 / ${count}条`,
    `**刚刚检测到新视频**\n\n${lines.join("\n")}`
  );
}

// ---------- 日报 ----------

async function buildDigestMarkdown() {
  const s = await getSettings();
  if (!s.creators?.length) return "还没有添加任何监控博主。";
  const lines = [
    `**监控人数**：${s.creators.filter((c) => !c.paused).length}`,
    `**上次检查**：${formatTime(s.lastCheckAt) || "（尚未检查）"}`,
    "",
    "当前监控列表：",
  ];
  for (const c of s.creators) {
    const mark = c.paused ? "（暂停）" : c.baselineSet ? "" : "（未建立基线）";
    lines.push(`- @${c.nickname || c.sec_uid.slice(0, 10)}${mark}`);
  }
  return lines.join("\n");
}

async function runDailyDigest() {
  const s = await getSettings();
  if (!s.enabled || !s.serverChanKey) return;

  const now = new Date();
  const today = now.toDateString();
  if (s.lastDigestDate === today) return;

  // 仅在 DIGEST 推荐时间附近触发：每天 20:00–20:30
  if (now.getHours() !== 20) return;

  const summary = await buildDigestMarkdown();
  const r = await sendServerChan("抖音关注 · 每日摘要", summary);
  if (r.ok) {
    await setSettings({ lastDigestDate: today });
  }
}

// ---------- 监控标签页 ----------

async function openMonitorTab(url) {
  const data = await chrome.storage.local.get(MONITOR_TAB_KEY);
  let tabId = data[MONITOR_TAB_KEY];
  if (tabId != null) {
    try {
      await chrome.tabs.get(tabId);
      await chrome.tabs.update(tabId, { url, active: false });
      await waitTabComplete(tabId, 15000);
      return tabId;
    } catch {
      tabId = null;
    }
  }
  const tab = await chrome.tabs.create({ url, active: false });
  await chrome.storage.local.set({ [MONITOR_TAB_KEY]: tab.id });
  await waitTabComplete(tab.id, 15000);
  return tab.id;
}

function waitTabComplete(tabId, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, timeoutMs);
    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
