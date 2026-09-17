const $ = (sel) => document.querySelector(sel);

let state = { settings: null };

async function send(msg) {
  return chrome.runtime.sendMessage(msg);
}

function toast(text, isError = false) {
  const el = $("#toast");
  el.textContent = text;
  el.classList.toggle("error", isError);
  el.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add("hidden"), 3500);
}

function showOnboard() {
  $("#onboard").classList.remove("hidden");
  $("#main").classList.add("hidden");
}

function showMain() {
  $("#onboard").classList.add("hidden");
  $("#main").classList.remove("hidden");
  fillForm();
  renderCreators();
  renderStatus();
}

function fillForm() {
  const s = state.settings;
  $("#serverChanKey").value = s.serverChanKey || "";
  $("#intervalMinutes").value = s.intervalMinutes || 2;
  $("#quietStart").value = s.quietStart || "23:00";
  $("#quietEnd").value = s.quietEnd || "08:00";
  $("#enabledToggle").checked = !!s.enabled;
  $("#statusDot").classList.toggle("on", !!s.enabled && !!s.serverChanKey);
}

function renderStatus() {
  const s = state.settings;
  const n = (s.creators || []).filter((c) => !c.paused).length;
  const last = s.lastCheckAt
    ? new Date(s.lastCheckAt).toLocaleString("zh-CN", { hour12: false })
    : "尚未检查";
  $("#statusLine").textContent = `监控中 ${n} 人 · 上次检查：${last} · 数据仅存本机`;
}

function renderCreators() {
  const list = $("#creatorList");
  const creators = state.settings?.creators || [];
  $("#creatorCount").textContent = `(${creators.length})`;
  if (!creators.length) {
    list.innerHTML =
      '<li class="empty">还没有监控对象。打开抖音博主主页后点「+ 当前页博主」。</li>';
    return;
  }
  list.innerHTML = "";
  for (const c of creators) {
    const li = document.createElement("li");

    const img = document.createElement("img");
    img.className = "avatar";
    img.referrerPolicy = "no-referrer";
    if (c.avatar_url) img.src = c.avatar_url;
    else img.style.visibility = "hidden";

    const meta = document.createElement("div");
    meta.className = "meta";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = c.nickname || c.sec_uid.slice(0, 12);
    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = c.paused
      ? "已暂停"
      : c.baselineSet
        ? c.last_checked_at
          ? `上次 ${formatTime(c.last_checked_at)}`
          : "已建立基线"
        : "待建立基线";
    meta.append(name, sub);

    const actions = document.createElement("div");
    actions.className = "actions";

    const btnPause = document.createElement("button");
    btnPause.textContent = c.paused ? "恢复" : "暂停";
    btnPause.onclick = async () => {
      c.paused = !c.paused;
      await persistCreators();
      renderCreators();
    };

    const btnOpen = document.createElement("button");
    btnOpen.textContent = "打开";
    btnOpen.onclick = () => chrome.tabs.create({ url: c.profile_url });

    const btnDel = document.createElement("button");
    btnDel.textContent = "删除";
    btnDel.className = "danger";
    btnDel.onclick = async () => {
      state.settings.creators = state.settings.creators.filter(
        (x) => x.sec_uid !== c.sec_uid
      );
      await persistCreators();
      renderCreators();
      renderStatus();
    };

    actions.append(btnPause, btnOpen, btnDel);
    li.append(img, meta, actions);
    list.append(li);
  }
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return iso;
  }
}

async function persistCreators() {
  const r = await send({
    type: "SAVE_SETTINGS",
    patch: { creators: state.settings.creators },
  });
  state.settings = r.settings;
}

async function saveSettingsFromForm() {
  const patch = {
    serverChanKey: $("#serverChanKey").value.trim(),
    intervalMinutes: Math.max(1, Number($("#intervalMinutes").value) || 2),
    quietStart: $("#quietStart").value || "23:00",
    quietEnd: $("#quietEnd").value || "08:00",
  };
  const r = await send({ type: "SAVE_SETTINGS", patch });
  state.settings = r.settings;
  fillForm();
  renderStatus();
}

function bindOnboard() {
  const keyInput = $("#onboardKey");
  const msg = $("#onboardMsg");
  const done = $("#onboardDone");

  $("#onboardTest").onclick = async () => {
    const key = keyInput.value.trim();
    if (!key) {
      msg.className = "msg err";
      msg.textContent = "请先粘贴 Key";
      return;
    }
    msg.className = "msg";
    msg.textContent = "发送中…";
    await send({ type: "SAVE_SETTINGS", patch: { serverChanKey: key, onboarded: true } });
    const r = await send({ type: "TEST_PUSH" });
    if (r.ok) {
      msg.className = "msg ok";
      msg.textContent = "已发送！请打开手机微信查看「方糖」。";
      done.disabled = false;
    } else {
      msg.className = "msg err";
      msg.textContent = `发送失败：${r.error || "请检查 Key 是否正确"}`;
      done.disabled = true;
    }
  };

  keyInput.addEventListener("input", () => {
    done.disabled = !keyInput.value.trim();
  });

  done.onclick = async () => {
    await send({
      type: "SAVE_SETTINGS",
      patch: {
        serverChanKey: keyInput.value.trim(),
        onboarded: true,
        enabled: true,
      },
    });
    const resp = await send({ type: "GET_STATE" });
    state.settings = resp.settings;
    showMain();
  };
}

function bindMain() {
  $("#btnAddCurrent").onclick = async () => {
    try {
      const r = await send({ type: "ADD_FROM_TAB" });
      const resp = await send({ type: "GET_STATE" });
      state.settings = resp.settings;
      renderCreators();
      renderStatus();
      toast(`已添加 @${r.creator?.nickname || r.creator?.sec_uid?.slice(0, 8) || ""}`);
    } catch (err) {
      toast(err.message || String(err), true);
    }
  };

  $("#btnImportFollowing").onclick = async () => {
    try {
      const r = await send({ type: "IMPORT_FOLLOWING" });
      const resp = await send({ type: "GET_STATE" });
      state.settings = resp.settings;
      renderCreators();
      renderStatus();
      toast(`已导入 ${r.imported} 个博主（首次仅记录，不会当新视频推送）`);
    } catch (err) {
      toast(err.message || String(err), true);
    }
  };

  $("#btnCheckNow").onclick = async () => {
    const btn = $("#btnCheckNow");
    btn.disabled = true;
    btn.textContent = "检查中…";
    try {
      const r = await send({ type: "RUN_CHECK" });
      if (r.result?.skipped) {
        toast(`已跳过：${r.result.skipped}`);
      } else {
        const news = (r.result?.results || []).reduce(
          (n, x) => n + (x.news?.length || 0),
          0
        );
        toast(news ? `检查完成，发现 ${news} 条新视频` : "检查完成，暂无新视频");
      }
      const resp = await send({ type: "GET_STATE" });
      state.settings = resp.settings;
      renderCreators();
      renderStatus();
    } catch (err) {
      toast(err.message || String(err), true);
    } finally {
      btn.disabled = false;
      btn.textContent = "立即检查";
    }
  };

  $("#btnSave").onclick = async () => {
    await saveSettingsFromForm();
    toast("已保存");
  };

  $("#enabledToggle").onchange = async (e) => {
    const r = await send({
      type: "SAVE_SETTINGS",
      patch: { enabled: e.target.checked },
    });
    state.settings = r.settings;
    fillForm();
  };

  $("#btnTestPush").onclick = async () => {
    await saveSettingsFromForm();
    const r = await send({ type: "TEST_PUSH" });
    if (r.ok) toast("已发送，请查看微信「方糖」");
    else toast(r.error || "推送失败", true);
  };

  $("#btnDigest").onclick = async () => {
    const r = await send({ type: "RUN_DIGEST" });
    if (r.push?.ok) toast("摘要已发送");
    else toast(r.push?.error || "发送失败", true);
  };
}

async function init() {
  bindOnboard();
  bindMain();
  const resp = await send({ type: "GET_STATE" });
  state.settings = resp.settings;

  if (!state.settings.onboarded || !state.settings.serverChanKey) {
    showOnboard();
  } else {
    showMain();
  }
}

init().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="padding:12px;color:#b91c1c">${String(err)}</pre>`;
});
