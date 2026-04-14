/**********************************************
 * My Black Window - Dashboard
 * Версия 4.1
 * - Климат 2x3
 * - Регулировка громкости в плеере
 **********************************************/

const TOKEN = window.ANDROID_TOKEN || "SECURE_TOKEN_2025";

const App = (function() {
  "use strict";

  const DEBUG = false;
  const log = (...args) => DEBUG && console.log("[App]", ...args);
  const warn = (...args) => console.warn("[App]", ...args);
  const error = (...args) => console.error("[App]", ...args);

  const storage = {
    save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { error("Storage save error:", e); } },
    load(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { error("Storage load error:", e); return null; } }
  };

  const android = {
    call(method, ...args) {
      if (window.androidApi && typeof window.androidApi[method] === 'function') {
        try { return window.androidApi[method](...args); } catch (e) { error(`Android API error [${method}]:`, e); }
      } else { warn(`Android API method not available: ${method}`); }
      return null;
    },
    runEnum(cmd) { this.call('runEnum', TOKEN, cmd); },
    getRunEnum() { return this.call('getRunEnum', TOKEN) || '[]'; },
    getRunEnumPic(cmd) { return this.call('getRunEnumPic', TOKEN, cmd); },
    getUserApps() { return this.call('getUserApps', TOKEN) || '[]'; },
    runApp(pkg) { this.call('runApp', TOKEN, pkg); },
    requestClimateState() { this.call('requestClimateState', TOKEN); },
    requestClimateStateForCommand(cmd) { this.call('requestClimateStateForCommand', TOKEN, cmd); },
    setVolume(volume) { this.call('setvol', TOKEN, volume); },
    onJsReady() { this.call('onJsReady', TOKEN); },
    onClose() { this.call('onClose', TOKEN); },
    onSettings() { this.call('onSettings', TOKEN); }
  };

  function showToast(message, duration = 3000) {
    const existing = document.querySelector('.toast-message');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    toast.style.cssText = `position:fixed; top:5rem; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:white; padding:0.8rem 1.5rem; border-radius:2rem; font-size:1rem; backdrop-filter:blur(5px); z-index:10000; white-space:nowrap; box-shadow:0 4px 12px rgba(0,0,0,0.3); animation:fadeInOutTop ${duration}ms ease-in-out; pointer-events:none;`;
    if (!document.getElementById('toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `@keyframes fadeInOutTop { 0% { opacity:0; transform:translateX(-50%) translateY(-20px); } 10% { opacity:1; transform:translateX(-50%) translateY(0); } 90% { opacity:1; transform:translateX(-50%) translateY(0); } 100% { opacity:0; transform:translateX(-50%) translateY(-20px); } }`;
      document.head.appendChild(style);
    }
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  }

  function makeLongPressable(element, callback, options = {}) {
    const { delay = 700, ripple = true, preventDefaultOnStart = false } = options;
    let pressTimer, longPressTriggered = false;
    const addRipple = (e) => {
      if (!ripple) return;
      const rect = element.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = (e.clientX || (e.touches ? e.touches[0].clientX : rect.left + rect.width/2)) - rect.left;
      const y = (e.clientY || (e.touches ? e.touches[0].clientY : rect.top + rect.height/2)) - rect.top;
      const rippleEl = document.createElement('span');
      rippleEl.classList.add('ripple');
      rippleEl.style.cssText = `position:absolute; border-radius:50%; background:rgba(255,255,255,0.3); transform:scale(0); animation:ripple-animation 0.5s ease-out; pointer-events:none; width:${size}px; height:${size}px; left:${x - size/2}px; top:${y - size/2}px;`;
      element.style.position = 'relative';
      element.appendChild(rippleEl);
      setTimeout(() => rippleEl.remove(), 500);
    };
    const start = (e) => {
      longPressTriggered = false;
      clearTimeout(pressTimer);
      if (preventDefaultOnStart) e.preventDefault();
      pressTimer = setTimeout(() => { longPressTriggered = true; addRipple(e); callback(element, e); }, delay);
    };
    const cancel = () => clearTimeout(pressTimer);
    const end = (e) => {
      clearTimeout(pressTimer);
      if (longPressTriggered) {
        e?.preventDefault();
        longPressTriggered = false;
      }
    };
    element.addEventListener('touchstart', start, { passive: !preventDefaultOnStart });
    element.addEventListener('touchend', end);
    element.addEventListener('touchcancel', cancel);
    element.addEventListener('mousedown', start);
    element.addEventListener('mouseup', end);
    element.addEventListener('mouseleave', cancel);
  }

  const loader = {
    show() { document.getElementById('global-loader')?.classList.remove('hidden'); },
    hide() { document.getElementById('global-loader')?.classList.add('hidden'); }
  };

  const modules = {};

  // --- Обои ---
  modules.wallpaper = (function() {
    const staticWallpapers = Array.from(document.querySelectorAll('.wallpaper-item')).map(item => item.dataset.src);
    let customWallpaperIndex = 0;
    const CACHE_KEY = 'wallpaper_cache', CACHE_INDEX_KEY = 'wallpaper_cache_index', MAX_CACHE_SIZE = 10;
    const IMAGE_SOURCES = [
      { name: 'Picsum', url: (w, h) => `https://picsum.photos/${w}/${h}?random&t=${Date.now()}` },
      { name: 'LoremFlickr', url: (w, h) => `https://loremflickr.com/${w}/${h}/landscape?random&lock=${Date.now()}` },
      { name: 'PlaceKitten', url: (w, h) => `https://placekitten.com/${w}/${h}?image=${Math.floor(Math.random()*100)}` },
      { name: 'JCARTools', url: (w, h) => `https://jcartools.ru/run/picsum_proxy.php?${w}/${h}&t=${Date.now()}` }
    ];
    let preloadImage = null, preloadAbortController = null;

    let videoElement = document.getElementById('video-background');
    if (!videoElement) {
      videoElement = document.createElement('video');
      videoElement.id = 'video-background';
      videoElement.muted = true;
      videoElement.loop = true;
      videoElement.playsInline = true;
      videoElement.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; object-fit:cover; z-index:-1; pointer-events:none; display:none;';
      document.body.appendChild(videoElement);
    }

    let videoWatchdogInterval = null;

    function stopWatchdog() { if (videoWatchdogInterval) { clearInterval(videoWatchdogInterval); videoWatchdogInterval = null; } }
    function startWatchdog() {
      stopWatchdog();
      videoWatchdogInterval = setInterval(() => {
        if (videoElement && videoElement.style.display === 'block' && videoElement.paused) {
          log('Watchdog: video paused, restarting');
          videoElement.play().catch(e => warn('Watchdog play failed:', e));
        }
      }, 1000);
    }
    function setupVideoLoop() {
      videoElement.removeEventListener('ended', handleVideoEnded);
      videoElement.addEventListener('ended', handleVideoEnded);
      startWatchdog();
    }
    function handleVideoEnded() {
      log('Video ended, restarting');
      videoElement.currentTime = 0;
      videoElement.play().catch(e => warn('Video replay failed:', e));
    }

    function getRandomSource() { return IMAGE_SOURCES[Math.floor(Math.random() * IMAGE_SOURCES.length)]; }
    async function fetchImage(url, timeoutMs = 8000) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (blob.size < 10000) throw new Error('Image too small');
        return new Promise(r => { const fr = new FileReader(); fr.onloadend = () => r(fr.result); fr.readAsDataURL(blob); });
      } finally { clearTimeout(timeout); }
    }
    function getCache() { return storage.load(CACHE_KEY) || []; }
    function saveCache(cache) {
      const unique = [...new Set(cache)];
      if (unique.length > MAX_CACHE_SIZE) unique.length = MAX_CACHE_SIZE;
      storage.save(CACHE_KEY, unique);
    }
    function addToCache(base64) {
      const cache = getCache().filter(item => item !== base64);
      cache.unshift(base64);
      saveCache(cache);
    }
    function getNextFromCache() {
      const cache = getCache();
      if (!cache.length) return null;
      let index = storage.load(CACHE_INDEX_KEY) || 0;
      if (index >= cache.length) index = 0;
      const img = cache[index];
      storage.save(CACHE_INDEX_KEY, (index + 1) % cache.length);
      return img;
    }
    function resetCacheIndex() { storage.save(CACHE_INDEX_KEY, 0); }
    async function preloadNextWallpaper() {
      if (preloadAbortController) preloadAbortController.abort();
      preloadAbortController = new AbortController();
      const w = window.innerWidth, h = window.innerHeight;
      const source = getRandomSource();
      try {
        const base64 = await fetchImage(source.url(w, h), 10000);
        preloadImage = base64;
        addToCache(base64);
        resetCacheIndex();
      } catch (e) { preloadImage = null; }
      finally { preloadAbortController = null; }
    }
    function applyWallpaper(base64) {
      clearVideoBackground();
      document.body.style.backgroundImage = `url("${base64}")`;
      document.body.classList.remove('off-mode');
      storage.save('wallpaperMode', 'auto');
      storage.save('wallpaperImage', base64);
    }
    function clearVideoBackground() {
      stopWatchdog();
      if (videoElement) {
        videoElement.pause();
        videoElement.src = '';
        videoElement.style.display = 'none';
        videoElement.removeEventListener('ended', handleVideoEnded);
      }
      document.body.classList.remove('has-video-background');
    }
    function setVideoBackground(fileOrUrl) {
      let url;
      if (typeof fileOrUrl === 'string') url = fileOrUrl;
      else url = URL.createObjectURL(fileOrUrl);
      clearVideoBackground();
      videoElement.src = url;
      videoElement.style.display = 'block';
      videoElement.loop = true;
      setupVideoLoop();
      videoElement.play().catch(e => warn('Video play failed:', e));
      document.body.style.backgroundImage = 'none';
      document.body.classList.add('has-video-background');
      document.body.classList.remove('off-mode');
      storage.save('wallpaperMode', 'video');
      storage.save('wallpaperVideo', url);
    }
    async function setAuto(showLoader = true) {
      clearVideoBackground();
      const w = window.innerWidth, h = window.innerHeight;
      if (preloadImage) {
        applyWallpaper(preloadImage);
        addToCache(preloadImage);
        preloadImage = null;
        preloadNextWallpaper();
        return;
      }
      const cached = getNextFromCache();
      if (cached) {
        applyWallpaper(cached);
        preloadNextWallpaper();
        return;
      }
      if (showLoader) loader.show();
      try {
        const source = getRandomSource();
        const base64 = await fetchImage(source.url(w, h));
        applyWallpaper(base64);
        addToCache(base64);
        resetCacheIndex();
        preloadNextWallpaper();
      } catch (e) {
        if (showLoader) showToast('Не удалось загрузить обои', 3000);
        try {
          const fb = IMAGE_SOURCES.find(s => s.name === 'Picsum');
          const base64 = await fetchImage(fb.url(w, h));
          applyWallpaper(base64);
          addToCache(base64);
          resetCacheIndex();
        } catch { setCustomByIndex(0); }
      } finally { if (showLoader) loader.hide(); }
    }
    function setOff() {
      clearVideoBackground();
      document.body.style.backgroundImage = "none";
      document.body.style.backgroundColor = "#0F0D13";
      document.body.classList.add('off-mode');
      const tw = document.querySelector('.widget_time');
      if (tw) { tw.classList.add('glowing'); setTimeout(() => tw.classList.remove('glowing'), 5000); }
    }
    function setCustomByIndex(index) {
      clearVideoBackground();
      if (!staticWallpapers.length) return;
      const src = staticWallpapers[index % staticWallpapers.length];
      document.body.style.backgroundImage = `url(${src})`;
      document.body.classList.remove('off-mode', 'has-video-background');
      storage.save('wallpaperMode', 'custom');
      storage.save('wallpaperCustom', src);
      storage.save('customWallpaperIndex', index);
      customWallpaperIndex = index;
    }
    function nextCustom() {
      if (storage.load('wallpaperMode') !== 'custom') return;
      let idx = storage.load('customWallpaperIndex') || 0;
      if (idx === -1) return;
      setCustomByIndex((idx + 1) % staticWallpapers.length);
    }
    function restore() {
      const mode = storage.load('wallpaperMode');
      if (mode === 'custom') {
        clearVideoBackground();
        const bg = storage.load('wallpaperCustom'), idx = storage.load('customWallpaperIndex');
        if (bg) document.body.style.backgroundImage = `url(${bg})`;
        if (idx !== undefined) customWallpaperIndex = idx;
        document.body.classList.remove('off-mode');
      } else if (mode === 'auto') {
        clearVideoBackground();
        const saved = storage.load('wallpaperImage');
        if (saved) { applyWallpaper(saved); preloadNextWallpaper(); }
        else setAuto(false);
      } else if (mode === 'video') {
        const savedVideo = storage.load('wallpaperVideo');
        if (savedVideo) {
          videoElement.src = savedVideo;
          videoElement.style.display = 'block';
          videoElement.loop = true;
          setupVideoLoop();
          videoElement.play().catch(e=>{});
          document.body.classList.add('has-video-background');
          document.body.style.backgroundImage = 'none';
          document.body.classList.remove('off-mode');
        } else { setCustomByIndex(0); }
      } else { setTimeout(() => setCustomByIndex(0), 100); }
    }
    function toggleOffMode() {
      if (document.body.classList.contains('off-mode')) {
        const savedMode = storage.load('wallpaperMode') || 'custom';
        if (savedMode === 'auto') setAuto(true);
        else if (savedMode === 'custom') setCustomByIndex(storage.load('customWallpaperIndex') || 0);
        else if (savedMode === 'video') {
          const url = storage.load('wallpaperVideo');
          if (url) {
            videoElement.src = url;
            videoElement.style.display = 'block';
            videoElement.loop = true;
            setupVideoLoop();
            videoElement.play();
            document.body.classList.add('has-video-background');
            document.body.style.backgroundImage = 'none';
          }
        }
        document.body.classList.remove('off-mode');
      } else { setOff(); }
    }
    function toggleAutoMode() {
      const currentMode = storage.load('wallpaperMode') || 'custom';
      if (currentMode === 'auto') {
        const idx = storage.load('customWallpaperIndex') || 0;
        setCustomByIndex(idx);
      } else { setAuto(true); }
      const btn = document.getElementById('btnWallpaper');
      if (btn) btn.classList.toggle('active', storage.load('wallpaperMode') === 'auto');
    }
    function initAutoMode() { if (storage.load('wallpaperMode') === 'auto') preloadNextWallpaper(); }

    return { setOff, setAuto, setCustomByIndex, nextCustom, restore, toggleOffMode, toggleAutoMode, initAutoMode, setVideoBackground };
  })();

  // --- Часы ---
  modules.clock = (function() {
    const flipClock = document.getElementById('flipClock'), dateDisplay = document.getElementById('dateDisplay'), weekdayDisplay = document.getElementById('weekdayDisplay');
    let rafId = null, lastMinute = -1;
    function update() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2,'0'), m = String(now.getMinutes()).padStart(2,'0');
      if (m !== lastMinute) {
        lastMinute = m;
        if (flipClock) flipClock.innerHTML = `<span class="flip-digit">${h[0]}</span><span class="flip-digit">${h[1]}</span><span class="flip-separator">:</span><span class="flip-digit">${m[0]}</span><span class="flip-digit">${m[1]}</span>`;
        const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
        const weekdays = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
        if (dateDisplay) dateDisplay.textContent = `${now.getDate()} ${months[now.getMonth()]}`;
        if (weekdayDisplay) weekdayDisplay.textContent = weekdays[now.getDay()];
      }
      rafId = requestAnimationFrame(update);
    }
    function start() { if (rafId) cancelAnimationFrame(rafId); update(); }
    function stop() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
    return { start, stop };
  })();

  // --- Перетаскивание кнопки сети ---
  modules.draggableNetwork = (function() {
    const btn = document.getElementById('btnNetwork');
    if (!btn) return { init(){} };
    let isDragging = false, startX, startY, startLeft, startTop, rafPending = false, newLeft, newTop;
    const saved = storage.load('networkPos');
    if (saved) { btn.style.left = saved.left+'px'; btn.style.top = saved.top+'px'; btn.style.right = 'auto'; btn.style.bottom = 'auto'; }
    function getPos() { const r = btn.getBoundingClientRect(); return { left: r.left, top: r.top }; }
    function onStart(e) {
      e.preventDefault();
      const t = e.touches ? e.touches[0] : e;
      startX = t.clientX; startY = t.clientY;
      const p = getPos(); startLeft = p.left; startTop = p.top;
      isDragging = true; btn.style.cursor = 'grabbing'; btn.style.transition = 'none';
    }
    function onMove(e) {
      if (!isDragging) return;
      e.preventDefault();
      const t = e.touches ? e.touches[0] : e;
      newLeft = Math.max(0, Math.min(startLeft + t.clientX - startX, window.innerWidth - btn.offsetWidth));
      newTop = Math.max(0, Math.min(startTop + t.clientY - startY, window.innerHeight - btn.offsetHeight));
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(() => {
          btn.style.left = newLeft+'px'; btn.style.top = newTop+'px';
          btn.style.right = 'auto'; btn.style.bottom = 'auto';
          rafPending = false;
        });
      }
    }
    function onEnd() {
      if (isDragging) {
        isDragging = false; btn.style.cursor = 'grab'; btn.style.transition = '';
        storage.save('networkPos', { left: parseFloat(btn.style.left), top: parseFloat(btn.style.top) });
      }
    }
    function init() {
      btn.addEventListener('touchstart', onStart, { passive: false });
      btn.addEventListener('touchmove', onMove, { passive: false });
      btn.addEventListener('touchend', onEnd); btn.addEventListener('touchcancel', onEnd);
      btn.addEventListener('mousedown', onStart);
      window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onEnd);
    }
    return { init };
  })();

  // --- Редактирование надписи ---
  modules.brandEditor = (function() {
    const brandEl = document.getElementById('editableBrand');
    const modal = document.getElementById('brandEditorModal');
    const input = document.getElementById('brandTextInput');
    const saveBtn = document.getElementById('saveBrandEdit');
    const cancelBtn = document.getElementById('cancelBrandEdit');

    function showModal() { input.value = brandEl.textContent; modal.classList.add('open'); input.focus(); }
    function hideModal() {
      modal.classList.remove('open');
      input.blur();
      brandEl.style.position = 'fixed';
      brandEl.style.bottom = '0.3rem';
      brandEl.style.left = '0';
      brandEl.style.right = '0';
      brandEl.style.textAlign = 'center';
      brandEl.style.color = 'rgba(255, 255, 255, 0.25)';
      brandEl.style.fontSize = '1.8rem';
      brandEl.style.fontWeight = '300';
      brandEl.style.letterSpacing = '2px';
      brandEl.style.pointerEvents = 'auto';
      brandEl.style.zIndex = '400';
      brandEl.style.cursor = 'pointer';
      brandEl.style.userSelect = 'none';
      void brandEl.offsetHeight;
    }
    function saveBrand() {
      const newText = input.value.trim();
      if (newText) { brandEl.textContent = newText; storage.save('brandText', newText); }
      hideModal();
    }
    function init() {
      makeLongPressable(brandEl, showModal, { delay: 700 });
      saveBtn.addEventListener('click', saveBrand);
      cancelBtn.addEventListener('click', hideModal);
      modal.addEventListener('click', e => { if (e.target === modal) hideModal(); });
      const savedText = storage.load('brandText');
      if (savedText) brandEl.textContent = savedText;
    }
    return { init };
  })();

  // --- Плеер (с регулировкой громкости) ---
  modules.player = (function() {
    const titleEl = document.querySelector(".widget_player__title");
    const artistEl = document.querySelector(".widget_player__artist");
    const imgEl = document.querySelector(".widget_player__image img");
    const progressEl = document.querySelector(".widget_player__track_progress");
    const timeSpans = document.querySelectorAll(".widget_player__track_time span");
    const playBtn = document.getElementById("player__play");
    const pauseBtn = document.getElementById("player__pause");
    const volumeSlider = document.getElementById("volumeSlider");

    let volumeChangeTimer = null;

    function updateMusicInfo(data) {
      if (typeof data === "string") data = JSON.parse(data);
      if (titleEl) titleEl.textContent = data.SongName || "—";
      if (artistEl) artistEl.textContent = data.SongArtist || "";
      if (imgEl && data.SongAlbumPicture) imgEl.src = "data:image/png;base64," + data.SongAlbumPicture;
      const pos = parseFloat(data.Trpos||0), dur = parseFloat(data.Trdur||1);
      let percent = (pos / dur) * 100;
      if (dur === Infinity || dur > 86400000) percent = 0;
      if (progressEl) progressEl.style.width = Math.min(percent, 100) + "%";
      const format = t => { const m = Math.floor(t/60000), s = Math.floor((t%60000)/1000); return m+":"+String(s).padStart(2,'0'); };
      if (timeSpans.length >= 2) {
        timeSpans[0].textContent = format(pos);
        timeSpans[1].textContent = (dur === Infinity || dur > 86400000) ? "∞" : format(dur);
      }
      const playing = data.IsPlaying === true;
      if (playBtn) playBtn.style.display = playing ? "none" : "flex";
      if (pauseBtn) pauseBtn.style.display = playing ? "flex" : "none";
    }

    function handleVolumeChange() {
      const volume = parseInt(volumeSlider.value, 10);
      if (volumeChangeTimer) clearTimeout(volumeChangeTimer);
      volumeChangeTimer = setTimeout(() => {
        android.setVolume(volume);
        log(`Volume set to ${volume}%`);
      }, 100);
    }

    function init() {
      document.getElementById("player__prev")?.addEventListener("click", ()=> android.runEnum("MEDIA_BLACK"));
      document.getElementById("player__next")?.addEventListener("click", ()=> android.runEnum("MEDIA_NEXT"));
      playBtn?.addEventListener("click", ()=>{ android.runEnum("MEDIA_PLAY"); playBtn.style.display="none"; pauseBtn.style.display="flex"; });
      pauseBtn?.addEventListener("click", ()=>{ android.runEnum("MEDIA_PAUSE"); pauseBtn.style.display="none"; playBtn.style.display="flex"; });

      if (volumeSlider) {
        volumeSlider.addEventListener('input', handleVolumeChange);
      }
    }

    return { updateMusicInfo, init };
  })();

  // --- Климат (2x3, 6 слотов) ---
  modules.climate = (function() {
    let climateCommands = [], climateState = {};
    const fallback = [
      { cmd: "heat_seat_l", label: "Подогрев\nводителя", max:3, icon:"icons/Seat heated_left.svg" },
      { cmd: "heat_seat_r", label: "Подогрев\nпассажира", max:3, icon:"icons/Seat heated_right.svg" },
      { cmd: "heat_windshield_on", label: "Подогрев\nлобового", max:1, icon:"icons/Windshield defroster.svg", off: "heat_windshield_off" },
      { cmd: "heat_rearwindow_on", label: "Подогрев\nзаднего", max:1, icon:"icons/Rare windshield defroster.svg", off: "heat_rearwindow_off" },
      { cmd: "vent_seat_l", label: "Вентиляция\nводителя", max:3, icon:"icons/Seat vent_left.svg" },
      { cmd: "vent_seat_r", label: "Вентиляция\nпассажира", max:3, icon:"icons/Seat vent_right.svg" },
      { cmd: "heat_wheel_on", label: "Подогрев\nруля", max:1, icon:"icons/Steering wheel heat.svg", off: "heat_wheel_off" },
      { cmd: "heat_zad_seat_l", label: "Подогрев\nзад. лево", max:3, icon:"icons/Seat heated_left.svg" },
      { cmd: "heat_zad_seat_r", label: "Подогрев\nзад. право", max:3, icon:"icons/Seat heated_right.svg", off:"heat_zad_seat_r_off" },
      { cmd: "voditel_seat_1", label: "Память\nводитель 1", max:1, icon:"icons/Driver.svg" },
      { cmd: "voditel_seat_2", label: "Память\nводитель 2", max:1, icon:"icons/Driver.svg" },
      { cmd: "voditel_seat_3", label: "Память\nводитель 3", max:1, icon:"icons/Driver.svg" }
    ];
    function formatLabel(cmd){ return cmd; }
    async function loadCommands(){
      try{
        const list = JSON.parse(android.getRunEnum());
        const filtered = list.filter(c=>c.startsWith('heat_')||c.startsWith('vent_')||c.startsWith('voditel_'));
        if(!filtered.length) throw new Error();
        climateCommands = filtered.map(c=>{
          const base = { cmd:c, label:formatLabel(c), max:c.includes('seat')?3:1 };
          if (c === 'heat_zad_seat_r') base.off = 'heat_zad_seat_r_off';
          if (c === 'heat_wheel_on') base.off = 'heat_wheel_off';
          if (c === 'heat_windshield_on') base.off = 'heat_windshield_off';
          if (c === 'heat_rearwindow_on') base.off = 'heat_rearwindow_off';
          return base;
        });
        for(let c of climateCommands){ try{ const p=android.getRunEnumPic(c.cmd); c.icon=p?`data:image/png;base64,${p}`:'icons/Default.svg'; }catch{ c.icon='icons/Default.svg'; } }
      }catch{ climateCommands = fallback.map(c=>({...c})); }
    }
    function getOff(cmd){ return cmd.off || `${cmd.cmd}_0`; }
    function renderSlot(s){
      const id = s.dataset.climateSlot, saved = storage.load(`climate_slot_${id}`);
      s.innerHTML = "";
      if(!saved){ s.innerHTML='<span style="font-size:1.5rem;opacity:0.5;">+</span>'; s.classList.remove('active'); return; }
      const c = climateCommands.find(x=>x.cmd===saved); if(!c) return;
      const lvl = climateState[saved]||0, max=c.max||1;
      const dots = Array.from({length:max},(_,i)=>`<span class="climate-dot${i<lvl?' on':''}"></span>`).join('');
      s.innerHTML = `<img src="${c.icon}"><div class="climate-label">${c.label.replace(/\\n/g,'<br>')}</div><div class="climate-dots">${dots}</div>`;
      s.classList.toggle('active', lvl>0);
    }
    function updateAll(){ document.querySelectorAll('.climate_slot').forEach(renderSlot); }
    function turnOffAll(){
      for(let i=1;i<=6;i++){ 
        const cmd=storage.load(`climate_slot_${i}`); 
        if(!cmd) continue; 
        const c=climateCommands.find(x=>x.cmd===cmd); 
        if(c){ 
          const offCmd = getOff(c);
          android.runEnum(offCmd); 
          climateState[cmd]=0; 
        } 
      }
      updateAll();
    }
    function initPicker(){
      const picker=document.getElementById('climate-picker'), grid=document.getElementById('climate-picker-grid'), close=document.getElementById('climate-picker-close');
      let cur=null;
      function open(id){ cur=id; grid.innerHTML='';
        if(!climateCommands.length){ grid.innerHTML='<div style="grid-column:1/-1;padding:20px;">Нет функций</div>'; picker.classList.add('open'); return; }
        climateCommands.forEach(cmd=>{ const d=document.createElement('div'); d.className='picker-item'; d.innerHTML=`<img src="${cmd.icon}"><span>${cmd.label.replace(/\\n/g,' ')}</span>`;
          d.onclick=()=>{ storage.save(`climate_slot_${cur}`,cmd.cmd); climateState[cmd.cmd]=0; updateAll(); picker.classList.remove('open'); android.requestClimateStateForCommand(cmd.cmd); };
          grid.appendChild(d); });
        picker.classList.add('open');
      }
      close?.addEventListener('click',()=>picker.classList.remove('open'));
      picker.addEventListener('click',e=>{ if(e.target===picker) picker.classList.remove('open'); });
      document.querySelectorAll('.climate_slot').forEach(s=>{
        const id=s.dataset.climateSlot;
        makeLongPressable(s,()=>open(id),{delay:700, preventDefaultOnStart: false});
        s.addEventListener('click',e=>{
          const saved=storage.load(`climate_slot_${id}`); if(!saved){ open(id); return; }
          const c=climateCommands.find(x=>x.cmd===saved); if(!c) return;
          const max=c.max||1, curLvl=climateState[saved]||0, next=(curLvl+1)%(max+1);
          climateState[saved]=next;
          const cmd = next===0 ? getOff(c) : (max>1?`${saved}_${next}`:saved);
          android.runEnum(cmd); renderSlot(s);
        });
      });
    }
    async function init(){ await loadCommands(); initPicker(); updateAll(); document.getElementById('climateOffAll')?.addEventListener('click',turnOffAll); }
    return { init, updateState: function(data){ updateAll(); } };
  })();

  // --- Приложения ---
  modules.apps = (function() {
    function init() {
      const slots = document.querySelectorAll(".app_slot"), picker = document.getElementById("app_picker"), grid = document.getElementById("app-picker-grid"), close = document.getElementById("app-picker-close");
      slots.forEach(s=>{ const saved=storage.load("app_slot_"+s.dataset.slot); if(saved) s.innerHTML=`<img src="data:image/png;base64,${saved.icon}">`; });
      let cur=null;
      function open(slot){ cur=slot.dataset.slot; grid.innerHTML='<div style="grid-column:1/-1;padding:20px;">Загрузка...</div>'; picker.classList.add('open');
        setTimeout(()=>{ grid.innerHTML='';
          try{ JSON.parse(android.getUserApps()).forEach(app=>{ const d=document.createElement('div'); d.className='picker-item'; d.innerHTML=`<img src="data:image/png;base64,${app.icon}"><span>${app.name}</span>`;
            d.onclick=()=>{ storage.save("app_slot_"+cur,{package:app.package,name:app.name,icon:app.icon}); document.querySelector(`.app_slot[data-slot="${cur}"]`).innerHTML=`<img src="data:image/png;base64,${app.icon}">`; picker.classList.remove('open'); };
            grid.appendChild(d); }); }catch{ grid.innerHTML='<div style="padding:20px;">Ошибка</div>'; } },10);
      }
      close?.addEventListener('click',()=>picker.classList.remove('open'));
      picker.addEventListener('click',e=>{ if(e.target===picker) picker.classList.remove('open'); });
      slots.forEach(s=>{ makeLongPressable(s,()=>open(s),{delay:700});
        s.addEventListener('click',e=>{ if(e.detail===0) return; const app=storage.load("app_slot_"+s.dataset.slot); if(!app) open(s); else android.runApp(app.package); });
      });
    }
    return { init };
  })();

  // --- Сеть ---
  modules.network = (function() {
    let online=false, checking=false, checkInterval=null;
    const icon=document.getElementById('networkIconContainer'), btn=document.getElementById('btnNetwork');
    function setStatus(ok){ online=ok;
      if(ok){ icon.innerHTML='<svg class="network-svg" viewBox="0 0 24 24"><path d="M12 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm4.95-5.95c-1.6-1.6-3.1-2.3-4.95-2.3s-3.35.7-4.95 2.3l1.4 1.4c1.3-1.3 2.5-1.7 3.55-1.7s2.25.4 3.55 1.7l1.4-1.4zm3.15-3.95C17.8 5.8 15.1 4.75 12 4.75S6.2 5.8 3.9 8.1l1.4 1.4c2-2 4.3-2.75 6.7-2.75s4.7.75 6.7 2.75l1.4-1.4zm3.1-3.9C19.9.9 16.1-.5 12-.5S4.1.9.8 4.2l1.4 1.4c3-3 6.3-4.1 9.8-4.1s6.8 1.1 9.8 4.1l1.4-1.4z" fill="#4CAF50"/></svg>'; btn.title='Есть интернет'; }
      else { icon.innerHTML='<svg class="network-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#F44336" stroke-width="1.5" fill="none"/><path d="M8 8l8 8M16 8l-8 8" stroke="#F44336" stroke-width="1.5"/></svg>'; btn.title='Нет интернета'; }
    }
    function check(){ if(checking) return; checking=true; const img=new Image(); const t=setTimeout(()=>{ img.src=''; setStatus(false); checking=false; },5000);
      img.onload=()=>{ clearTimeout(t); setStatus(true); checking=false; };
      img.onerror=()=>{ clearTimeout(t); setStatus(false); checking=false; };
      img.src='https://yandex.ru/favicon.ico?_='+Date.now();
    }
    function init(){ check(); btn.addEventListener('click',()=>{ if(!checking) check(); }); window.addEventListener('online',()=>{ setStatus(true); check(); }); window.addEventListener('offline',()=>setStatus(false)); checkInterval=setInterval(check,120000); }
    return { init };
  })();

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

    document.addEventListener("contextmenu", e=>e.preventDefault());
    android.onJsReady();
  }

  async function start() { await modules.climate.init(); initUI(); }
  return { start };
})();

document.addEventListener("DOMContentLoaded", () => App.start());