/**********************************************
 * My Black Window - Dashboard
 * Точка входа: инициализация всех модулей
 **********************************************/

window.onAndroidEvent = function(type, data) {
  if (type === "musicInfo") modules.player.updateMusicInfo(data);
  else if (type === "climateState") modules.climate.updateState(data);
};

function initUI() {
  modules.wallpaper.restore();
  modules.wallpaper.initAutoMode();
  modules.clock.start();
  modules.draggableNetwork.init();
  modules.brandEditor.init();
  modules.player.init();
  modules.apps.init();
  modules.network.init();

  document.getElementById("btnClose")?.addEventListener("click", ()=> android.onClose());
  document.getElementById("btnSettings")?.addEventListener("click", ()=> android.onSettings());

  const btnWallpaper = document.getElementById("btnWallpaper");
  btnWallpaper?.addEventListener("click", () => { modules.wallpaper.toggleAutoMode(); });
  if (storage.load("wallpaperMode") === "auto") { btnWallpaper?.classList.add("active"); }

  document.body.addEventListener("click", e => {
    if (e.target === document.body) {
      const mode = storage.load("wallpaperMode");
      if (mode === "auto") modules.wallpaper.setAuto(true);
      else if (mode === "custom") modules.wallpaper.nextCustom();
    }
  });

  const sidebar = document.getElementById("sidebar");
  document.getElementById("openSidebar")?.addEventListener("click", ()=>sidebar.classList.add("open"));
  document.getElementById("closeSidebar")?.addEventListener("click", ()=>sidebar.classList.remove("open"));
  document.querySelectorAll(".wallpaper-item").forEach((it,i)=>{
    it.addEventListener("click", ()=>{ modules.wallpaper.setCustomByIndex(i); sidebar.classList.remove("open"); });
  });

  document.getElementById('presetVideoKamin')?.addEventListener('click', () => {
    modules.wallpaper.setVideoBackground('images/kamin HD.mp4');
    sidebar.classList.remove('open');
  });

  document.querySelector('.widget_time')?.addEventListener('click', () => { modules.wallpaper.toggleOffMode(); });

  // Включаем OEM-эффекты для всех интерактивных элементов
  attachOemTouchFeedback(".widget_buttons, #btnNetwork, #btnClose, .widget_player__btn, .close-btn, .drawer-close, .climate-off-all, .app_slot, .climate_slot");

  document.addEventListener("contextmenu", e=>e.preventDefault());
  android.onJsReady();
}

async function start() {
  await modules.climate.init();
  initUI();
}

document.addEventListener("DOMContentLoaded", start);