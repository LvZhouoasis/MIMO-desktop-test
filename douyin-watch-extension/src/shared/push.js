/**
 * Server酱直连推送（Turbo）
 * 文档：https://sct.ftqq.com/
 * 用户只需自己的 SendKey，不需要任何后端服务器。
 */

export async function sendServerChan(title, desp) {
  const { serverChanKey } = await chrome.storage.local.get("serverChanKey");
  const key = (serverChanKey || "").trim();
  if (!key) {
    return { ok: false, error: "未配置微信推送 Key" };
  }

  const endpoint = `https://sctapi.ftqq.com/${encodeURIComponent(key)}.send`;
  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams({
        title: String(title || "").slice(0, 100),
        desp: String(desp || ""),
      }),
    });
    const data = await resp.json().catch(() => ({}));
    const code = data?.code ?? data?.errno;
    if (resp.ok && (code === 0 || code === "0")) {
      return { ok: true, data };
    }
    return {
      ok: false,
      error: data?.message || data?.errmsg || `HTTP ${resp.status}`,
      data,
    };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export function isQuiet(settings, date = new Date()) {
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
