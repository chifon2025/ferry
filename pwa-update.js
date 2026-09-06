/* 開啟、回到前景與重新連線時檢查；不動玩家存檔。 */
"use strict";
(() => {
  const status = document.getElementById("updateStatus");
  const button = document.getElementById("btnUpdate");
  const isDev = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  let registration, checking = false, pending = false, reloading = false;
  let controlled = Boolean(navigator.serviceWorker?.controller);
  const setStatus = text => { if (status) status.textContent = text; };

  function applyUpdate() {
    if (!pending || reloading || document.hidden) return;
    if (!window.FerryPractice?.prepareUpdate()) {
      setStatus("新版已備妥，完成填寫後可套用");
      let banner = document.getElementById("updateNotice");
      if (!banner) {
        banner = document.createElement("div");
        banner.id = "updateNotice";
        banner.setAttribute("role", "status");
        banner.innerHTML = '<span>新版已準備好，請先完成或保存目前填寫的內容。</span><button type="button">套用更新</button>';
        banner.querySelector("button").addEventListener("click", applyUpdate);
        document.body.appendChild(banner);
      }
      return;
    }
    reloading = true;
    setStatus("正在開啟新版…");
    location.reload();
  }

  async function check() {
    if (pending) { applyUpdate(); return; }
    if (!registration || checking) return;
    if (navigator.onLine === false) { setStatus("目前離線，連線後自動檢查"); return; }
    checking = true;
    setStatus("正在檢查更新…");
    try {
      await registration.update();
      if (!pending && !reloading) setStatus(registration.installing ? "正在下載新版…" : "已完成更新檢查");
    } catch (_) {
      setStatus("暫時無法檢查，連線後可再試");
    } finally { checking = false; }
  }

  if (!("serviceWorker" in navigator) || location.protocol === "file:" || (isDev && !new URLSearchParams(location.search).has("offline-test"))) {
    setStatus("此預覽不啟用自動更新");
    if (button) button.disabled = true;
    return;
  }
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (controlled) { pending = true; applyUpdate(); }
    controlled = true;
  });
  async function start() {
    try {
      registration = await navigator.serviceWorker.register("./sw.js", {updateViaCache:"none"});
      registration.addEventListener("updatefound", () => {
        setStatus("正在下載新版…");
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "redundant") setStatus("新版下載未完成，稍後可再試");
          if (worker.state === "activated" && !pending && !reloading) setStatus("已完成更新檢查");
        });
      });
      await check();
    } catch (_) { setStatus("暫時無法檢查，點此重試"); }
  }
  button?.addEventListener("click", () => registration ? check() : start());
  window.addEventListener("online", () => registration ? check() : start());
  window.addEventListener("pageshow", () => { if (registration) check(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) registration ? check() : start(); });
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, {once:true});
})();
