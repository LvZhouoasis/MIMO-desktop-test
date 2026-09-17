/** 本地配置与关注列表（全部存在 chrome.storage.local，不上传任何服务器） */

const DEFAULTS = {
  serverChanKey: "",
  intervalMinutes: 2,
  enabled: true,
  onboarded: false,
  quietStart: "23:00",
  quietEnd: "08:00",
  mergeWindowSec: 60,
  creators: [],
  lastCheckAt: "",
  lastDigestDate: "",
};

export async function getSettings() {
  const data = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...data };
}

export async function setSettings(partial) {
  await chrome.storage.local.set(partial);
  return getSettings();
}

export async function upsertCreatorLocal(creator) {
  const { creators } = await getSettings();
  const idx = creators.findIndex((c) => c.sec_uid === creator.sec_uid);
  const next = {
    sec_uid: creator.sec_uid,
    nickname: creator.nickname || "",
    avatar_url: creator.avatar_url || "",
    profile_url:
      creator.profile_url || `https://www.douyin.com/user/${creator.sec_uid}`,
    priority: creator.priority || 0,
    paused: !!creator.paused,
    baselineSet: !!creator.baselineSet,
    last_video_id: creator.last_video_id || "",
    last_checked_at: creator.last_checked_at || "",
    pending: Array.isArray(creator.pending) ? creator.pending : [],
  };
  if (idx >= 0) {
    creators[idx] = { ...creators[idx], ...next };
  } else {
    creators.push(next);
  }
  await setSettings({ creators });
  return next;
}

export async function removeCreatorLocal(secUid) {
  const { creators } = await getSettings();
  await setSettings({
    creators: creators.filter((c) => c.sec_uid !== secUid),
  });
}

export function extractSecUidFromUrl(url) {
  if (!url) return null;
  try {
    const m = new URL(url).pathname.match(/\/user\/([A-Za-z0-9_\-]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function formatTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return iso;
  }
}

/** 当前是否处于静默时段（只汇总、不单条推送） */
export function inQuietHours(settings, date = new Date()) {
  const cur = date.getHours() * 60 + date.getMinutes();
  const parse = (s) => {
    const [h, m] = String(s || "0:0").split(":").map((n) => parseInt(n, 10) || 0);
    return h * 60 + m;
  };
  const start = parse(settings.quietStart);
  const end = parse(settings.quietEnd);
  if (start === end) return false;
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end;
}
