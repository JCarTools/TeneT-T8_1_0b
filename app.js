/**********************************************
 * My Black Window - Dashboard
 * Версия 3.2 (улучшенное разнообразие автообоев)
 **********************************************/

// Токен безопасности (должен быть получен из Android)
const TOKEN = window.ANDROID_TOKEN || "SECURE_TOKEN_2025";

// Глобальный объект приложения
const App = (function() {
  "use strict";

  // ---------- Конфигурация ----------
  const DEBUG = true;
  const log = (...args) => DEBUG && console.log("[App]", ...args);
  const warn = (...args) => console.warn("[App]", ...args);
  const error = (...args) => console.error("[App]", ...args);

  // ---------- Хелперы ----------
  const storage = {
    save(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) { error("Storage save error:", e); }
    },
    load(key) {
      try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : null;
      } catch (e) { error("Storage load error:", e); return null; }
    }
  };

  // Безопасный вызов Android API
  const android = {
    call(method, ...args) {
      if (window.androidApi && typeof window.androidApi[method] === 'function') {
        try {
          return window.androidApi[method](...args);
        } catch (e) { error(`Android API error [${method}]:`, e); }
      } else {
        warn(`Android API method not available: ${method}`);
      }
      return null;
    },
    runEnum(cmd) {
      log("Sending command:", cmd);
      this.call('runEnum', TOKEN, cmd);
    },
    getRunEnum() { 
      const result = this.call('getRunEnum', TOKEN);
      log("getRunEnum raw result:", result);
      return result || '[]';
    },
    getRunEnumPic(cmd) { return this.call('getRunEnumPic', TOKEN, cmd); },
    getUserApps() { return this.call('getUserApps', TOKEN) || '[]'; },
    runApp(pkg) { this.call('runApp', TOKEN, pkg); },
    requestClimateState() { this.call('requestClimateState', TOKEN); },
    requestClimateStateForCommand(cmd) { this.call('requestClimateStateForCommand', TOKEN, cmd); },
    onJsReady() { this.call('onJsReady', TOKEN); },
    onClose() { this.call('onClose', TOKEN); },
    onSettings() { this.call('onSettings', TOKEN); }
  };

  // ---------- Уведомления (toast) ----------
  function showToast(message, duration = 3000) {
    const existingToast = document.querySelector('.toast-message');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 5rem;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 0.8rem 1.5rem;
      border-radius: 2rem;
      font-size: 1rem;
      backdrop-filter: blur(5px);
      z-index: 10000;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: fadeInOutTop ${duration}ms ease-in-out;
      pointer-events: none;
    `;

    if (!document.getElementById('toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `
        @keyframes fadeInOutTop {
          0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
          10% { opacity: 1; transform: translateX(-50%) translateY(0); }
          90% { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  }

  // Универсальная функция длинного нажатия с ripple
  function makeLongPressable(element, callback, options = {}) {
    const { delay = 700, ripple = true } = options;
    let pressTimer;
    let longPressTriggered = false;

    const addRipple = (e) => {
      if (!ripple) return;
      const rect = element.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = (e.clientX || (e.touches ? e.touches[0].clientX : rect.left + rect.width/2)) - rect.left;
      const y = (e.clientY || (e.touches ? e.touches[0].clientY : rect.top + rect.height/2)) - rect.top;
      const rippleEl = document.createElement('span');
      rippleEl.classList.add('ripple');
      rippleEl.style.width = rippleEl.style.height = size + 'px';
      rippleEl.style.left = x - size/2 + 'px';
      rippleEl.style.top = y - size/2 + 'px';
      element.style.position = 'relative';
      element.appendChild(rippleEl);
      setTimeout(() => rippleEl.remove(), 500);
    };

    const start = (e) => {
      longPressTriggered = false;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        longPressTriggered = true;
        addRipple(e);
        callback(element, e);
      }, delay);
    };
    const cancel = () => {
      clearTimeout(pressTimer);
    };
    const end = (e) => {
      clearTimeout(pressTimer);
      if (longPressTriggered) {
        e?.preventDefault();
        longPressTriggered = false;
      }
    };

    element.addEventListener('touchstart', start, { passive: true });
    element.addEventListener('touchend', end);
    element.addEventListener('touchcancel', cancel);
    element.addEventListener('mousedown', start);
    element.addEventListener('mouseup', end);
    element.addEventListener('mouseleave', cancel);
  }

  // Показать/скрыть глобальный лоадер
  const loader = {
    show() { document.getElementById('global-loader')?.classList.remove('hidden'); },
    hide() { document.getElementById('global-loader')?.classList.add('hidden'); }
  };

  // ---------- Модули ----------
  const modules = {};

  // --- Обои (версия 3.2 с улучшенным разнообразием) ---
  modules.wallpaper = (function() {
    const staticWallpapers = Array.from(document.querySelectorAll('.wallpaper-item')).map(item => item.dataset.src);
    let customWallpaperIndex = 0;

    // Настройки кеша
    const CACHE_KEY = 'wallpaper_cache';
    const CACHE_INDEX_KEY = 'wallpaper_cache_index'; // для последовательного выбора
    const MAX_CACHE_SIZE = 10;

    // Источники с параметрами уникальности
    const IMAGE_SOURCES = [
      { 
        name: 'Picsum', 
        url: (w, h) => `https://picsum.photos/${w}/${h}?random&t=${Date.now()}` 
      },
      { 
        name: 'LoremFlickr', 
        url: (w, h) => `https://loremflickr.com/${w}/${h}/landscape?random&lock=${Date.now()}` 
      },
      { 
        name: 'PlaceKitten', 
        url: (w, h) => `https://placekitten.com/${w}/${h}?image=${Math.floor(Math.random()*100)}` 
      },
      { 
        name: 'JCARTools', 
        url: (w, h) => `https://jcartools.ru/run/picsum_proxy.php?${w}/${h}&t=${Date.now()}` 
      }
    ];

    // Переменная для предзагрузки
    let preloadImage = null;
    let preloadAbortController = null;

    function getRandomSource() {
      return IMAGE_SOURCES[Math.floor(Math.random() * IMAGE_SOURCES.length)];
    }

    async function fetchImage(url, timeoutMs = 8000) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (blob.size < 10000) throw new Error('Image too small');
        const base64 = await new Promise(r => {
          const fr = new FileReader();
          fr.onloadend = () => r(fr.result);
          fr.readAsDataURL(blob);
        });
        return base64;
      } finally {
        clearTimeout(timeout);
      }
    }

    // Управление кешем
    function getCache() {
      return storage.load(CACHE_KEY) || [];
    }

    function saveCache(cache) {
      // Убираем дубликаты (на всякий случай)
      const uniqueCache = [...new Set(cache)];
      if (uniqueCache.length > MAX_CACHE_SIZE) {
        uniqueCache.length = MAX_CACHE_SIZE;
      }
      storage.save(CACHE_KEY, uniqueCache);
    }

    function addToCache(base64) {
      const cache = getCache();
      // Удаляем существующий экземпляр
      const newCache = cache.filter(item => item !== base64);
      newCache.unshift(base64);
      saveCache(newCache);
    }

    // Последовательный выбор из кеша
    function getNextFromCache() {
      const cache = getCache();
      if (cache.length === 0) return null;

      let index = storage.load(CACHE_INDEX_KEY) || 0;
      // Убедимся, что индекс в пределах
      if (index >= cache.length) index = 0;

      const image = cache[index];
      
      // Увеличиваем индекс для следующего раза
      const nextIndex = (index + 1) % cache.length;
      storage.save(CACHE_INDEX_KEY, nextIndex);

      return image;
    }

    // Сброс индекса при изменении кеша
    function resetCacheIndex() {
      storage.save(CACHE_INDEX_KEY, 0);
    }

    // Предзагрузка следующего изображения (использует случайный источник)
    async function preloadNextWallpaper() {
      if (preloadAbortController) {
        preloadAbortController.abort();
      }
      preloadAbortController = new AbortController();
      const w = window.innerWidth, h = window.innerHeight;
      const source = getRandomSource();
      const url = source.url(w, h);
      log(`Preloading wallpaper from ${source.name}: ${url}`);

      try {
        const base64 = await fetchImage(url, 10000);
        preloadImage = base64;
        log('Preload successful, cached in memory');
        addToCache(base64);
        resetCacheIndex(); // сбрасываем индекс, т.к. кеш обновился
      } catch (e) {
        warn('Preload failed:', e);
        preloadImage = null;
      } finally {
        preloadAbortController = null;
      }
    }

    function applyWallpaper(base64) {
      document.body.style.backgroundImage = `url("${base64}")`;
      document.body.classList.remove('off-mode');
      storage.save('wallpaperMode', 'auto');
      storage.save('wallpaperImage', base64);
    }

    async function setAuto(showLoader = true) {
      const w = window.innerWidth, h = window.innerHeight;
      
      // 1. Предзагруженное изображение
      if (preloadImage) {
        log('Using preloaded image');
        applyWallpaper(preloadImage);
        addToCache(preloadImage);
        preloadImage = null;
        preloadNextWallpaper();
        return;
      }

      // 2. Последовательный выбор из кеша
      const cached = getNextFromCache();
      if (cached) {
        log('Using cached image (sequential)');
        applyWallpaper(cached);
        preloadNextWallpaper();
        return;
      }

      // 3. Загрузка с сервера
      if (showLoader) loader.show();
      try {
        const source = getRandomSource();
        const url = source.url(w, h);
        log(`Fetching wallpaper from ${source.name}: ${url}`);
        const base64 = await fetchImage(url);
        applyWallpaper(base64);
        addToCache(base64);
        resetCacheIndex();
        preloadNextWallpaper();
      } catch (e) {
        warn('All attempts to load wallpaper failed:', e);
        if (showLoader) showToast('Не удалось загрузить обои', 3000);
        // Пробуем резервный источник
        try {
          const fallbackSource = IMAGE_SOURCES.find(s => s.name === 'Picsum');
          const url = fallbackSource.url(w, h);
          const base64 = await fetchImage(url);
          applyWallpaper(base64);
          addToCache(base64);
          resetCacheIndex();
        } catch (e2) {
          setCustomByIndex(0);
        }
      } finally {
        if (showLoader) loader.hide();
      }
    }

    function setOff() {
      document.body.style.backgroundImage = "none";
      document.body.style.backgroundColor = "#0F0D13";
      document.body.classList.add('off-mode');
      const timeWidget = document.querySelector('.widget_time');
      if (timeWidget) { timeWidget.classList.add('glowing'); setTimeout(() => timeWidget.classList.remove('glowing'), 5000); }
      storage.save("wallpaperMode", "off");
    }

    function setCustomByIndex(index) {
      if (!staticWallpapers.length) return;
      const src = staticWallpapers[index % staticWallpapers.length];
      document.body.style.backgroundImage = `url(${src})`;
      document.body.classList.remove('off-mode');
      storage.save('wallpaperMode', 'custom');
      storage.save('wallpaperCustom', src);
      storage.save('customWallpaperIndex', index);
      customWallpaperIndex = index;
    }

    function nextCustom() {
      if (storage.load('wallpaperMode') !== 'custom') return;
      let idx = storage.load('customWallpaperIndex') || 0;
      idx = (idx + 1) % staticWallpapers.length;
      setCustomByIndex(idx);
    }

    function restore() {
      const mode = storage.load('wallpaperMode');
      log("Restoring wallpaper, mode:", mode);
      
      if (mode === 'custom') {
        const bg = storage.load('wallpaperCustom'), idx = storage.load('customWallpaperIndex');
        if (bg) {
          document.body.style.backgroundImage = `url(${bg})`;
          document.body.classList.remove('off-mode');
        }
        if (idx !== undefined) customWallpaperIndex = idx;
      } else if (mode === 'auto') {
        const savedImage = storage.load('wallpaperImage');
        if (savedImage) {
          document.body.style.backgroundImage = `url("${savedImage}")`;
          document.body.classList.remove('off-mode');
          preloadNextWallpaper();
        } else {
          setAuto(false);
        }
      } else if (mode === 'off') {
        setOff();
      } else {
        setTimeout(() => setCustomByIndex(0), 100);
      }
    }

    function toggle() {
      const mode = storage.load('wallpaperMode');
      if (document.body.classList.contains('off-mode')) {
        if (mode === 'auto') setAuto(true);
        else if (mode === 'custom') setCustomByIndex(storage.load('customWallpaperIndex') || 0);
        else setAuto(true);
      } else {
        setOff();
      }
    }

    function initAutoMode() {
      if (storage.load('wallpaperMode') === 'auto') {
        preloadNextWallpaper();
      }
    }

    return { 
      setOff, 
      setAuto, 
      setCustomByIndex, 
      nextCustom, 
      restore, 
      toggle,
      initAutoMode 
    };
  })();

  // --- Часы ---
  modules.clock = (function() {
    const flipClock = document.getElementById('flipClock');
    const dateDisplay = document.getElementById('dateDisplay');
    const weekdayDisplay = document.getElementById('weekdayDisplay');
    let rafId = null;
    let lastMinute = -1;

    function update() {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      if (minutes !== lastMinute) {
        lastMinute = minutes;
        if (flipClock) {
          flipClock.innerHTML = `<span class="flip-digit">${hours[0]}</span><span class="flip-digit">${hours[1]}</span><span class="flip-separator">:</span><span class="flip-digit">${minutes[0]}</span><span class="flip-digit">${minutes[1]}</span>`;
        }
        const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
        const weekdays = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
        if (dateDisplay) dateDisplay.textContent = `${now.getDate()} ${months[now.getMonth()]}`;
        if (weekdayDisplay) weekdayDisplay.textContent = weekdays[now.getDay()];
      }
      rafId = requestAnimationFrame(update);
    }

    function start() {
      if (rafId) cancelAnimationFrame(rafId);
      update();
    }

    function stop() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop(); else start();
    });

    return { start, stop };
  })();

  // --- Перетаскивание кнопки сети ---
  modules.draggableNetwork = (function() {
    const btn = document.getElementById('btnNetwork');
    if (!btn) return { init(){} };

    let isDragging = false;
    let startX, startY, startLeft, startTop;
    let rafPending = false;
    let newLeft, newTop;

    const saved = storage.load('networkPos');
    if (saved) { btn.style.left = saved.left+'px'; btn.style.top = saved.top+'px'; btn.style.right = 'auto'; btn.style.bottom = 'auto'; }

    function getPos() { const r = btn.getBoundingClientRect(); return { left: r.left, top: r.top }; }

    function onStart(e) {
      e.preventDefault();
      const t = e.touches ? e.touches[0] : e;
      startX = t.clientX; startY = t.clientY;
      const p = getPos(); startLeft = p.left; startTop = p.top;
      isDragging = true;
      btn.style.cursor = 'grabbing';
      btn.style.transition = 'none';
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
          btn.style.left = newLeft + 'px';
          btn.style.top = newTop + 'px';
          btn.style.right = 'auto';
          btn.style.bottom = 'auto';
          rafPending = false;
        });
      }
    }

    function onEnd() {
      if (isDragging) {
        isDragging = false;
        btn.style.cursor = 'grab';
        btn.style.transition = '';
        storage.save('networkPos', { left: parseFloat(btn.style.left), top: parseFloat(btn.style.top) });
      }
    }

    function init() {
      btn.addEventListener('touchstart', onStart, { passive: false });
      btn.addEventListener('touchmove', onMove, { passive: false });
      btn.addEventListener('touchend', onEnd);
      btn.addEventListener('touchcancel', onEnd);
      btn.addEventListener('mousedown', onStart);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
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

    function showModal() {
      input.value = brandEl.textContent;
      modal.classList.add('open');
      input.focus();
    }
    function hideModal() { modal.classList.remove('open'); }
    function saveBrand() {
      const newText = input.value.trim();
      if (newText) {
        brandEl.textContent = newText;
        storage.save('brandText', newText);
      }
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

  // --- Плеер ---
  modules.player = (function() {
    const titleEl = document.querySelector(".widget_player__title");
    const artistEl = document.querySelector(".widget_player__artist");
    const imgEl = document.querySelector(".widget_player__image img");
    const progressEl = document.querySelector(".widget_player__track_progress");
    const timeSpans = document.querySelectorAll(".widget_player__track_time span");
    const playBtn = document.getElementById("player__play");
    const pauseBtn = document.getElementById("player__pause");

    function updateMusicInfo(data) {
      if (typeof data === "string") data = JSON.parse(data);
      if (titleEl) titleEl.textContent = data.SongName || "—";
      if (artistEl) artistEl.textContent = data.SongArtist || "";
      if (imgEl && data.SongAlbumPicture) imgEl.src = "data:image/png;base64," + data.SongAlbumPicture;

      const pos = parseFloat(data.Trpos || 0);
      const dur = parseFloat(data.Trdur || 1);
      if (progressEl) progressEl.style.width = (pos / dur * 100) + "%";

      const format = t => { const m = Math.floor(t/60000), s = Math.floor((t%60000)/1000); return m+":"+String(s).padStart(2,'0'); };
      if (timeSpans.length >= 2) {
        timeSpans[0].textContent = format(pos);
        timeSpans[1].textContent = format(dur);
      }

      const playing = data.IsPlaying === true;
      if (playBtn) playBtn.style.display = playing ? "none" : "flex";
      if (pauseBtn) pauseBtn.style.display = playing ? "flex" : "none";
    }

    function init() {
      document.getElementById("player__prev")?.addEventListener("click", () => android.runEnum("MEDIA_BLACK"));
      document.getElementById("player__next")?.addEventListener("click", () => android.runEnum("MEDIA_NEXT"));
      playBtn?.addEventListener("click", () => {
        android.runEnum("MEDIA_PLAY");
        playBtn.style.display = "none";
        pauseBtn.style.display = "flex";
      });
      pauseBtn?.addEventListener("click", () => {
        android.runEnum("MEDIA_PAUSE");
        pauseBtn.style.display = "none";
        playBtn.style.display = "flex";
      });
    }

    return { updateMusicInfo, init };
  })();

  // --- Климат (исправлен off для заднего правого) ---
  modules.climate = (function() {
    let climateCommands = [];
    const climateState = {};

    // Статический fallback-список с особым off для заднего правого
    const fallbackCommands = [
      { cmd: "heat_seat_l", label: "Подогрев\nводителя", max: 3, icon: "icons/Seat heated_left.svg" },
      { cmd: "heat_seat_r", label: "Подогрев\nпассажира", max: 3, icon: "icons/Seat heated_right.svg" },
      { cmd: "heat_windshield_on", label: "Подогрев\nлобового", max: 1, icon: "icons/Windshield defroster.svg" },
      { cmd: "heat_rearwindow_on", label: "Подогрев\nзаднего", max: 1, icon: "icons/Rare windshield defroster.svg" },
      { cmd: "vent_seat_l", label: "Вентиляция\nводителя", max: 3, icon: "icons/Seat vent_left.svg" },
      { cmd: "vent_seat_r", label: "Вентиляция\nпассажира", max: 3, icon: "icons/Seat vent_right.svg" },
      { cmd: "heat_wheel_on", label: "Подогрев\nруля", max: 1, icon: "icons/Steering wheel heat.svg" },
      { cmd: "heat_zad_seat_l", label: "Подогрев\nзад. лево", max: 3, icon: "icons/Seat heated_left.svg" },
      { cmd: "heat_zad_seat_r", label: "Подогрев\nзад. право", max: 3, icon: "icons/Seat heated_right.svg", off: "heat_zad_seat_r_off" }, // особый off
      { cmd: "voditel_seat_1", label: "Память\nводитель 1", max: 1, icon: "icons/Driver.svg" },
      { cmd: "voditel_seat_2", label: "Память\nводитель 2", max: 1, icon: "icons/Driver.svg" },
      { cmd: "voditel_seat_3", label: "Память\nводитель 3", max: 1, icon: "icons/Driver.svg" },
    ];

    function formatLabel(cmd) {
      if (cmd.includes('zad_seat_l')) return 'Подогрев\nзад. лево';
      if (cmd.includes('zad_seat_r')) return 'Подогрев\nзад. право';
      if (cmd.includes('seat_l')) return 'Подогрев\nводителя';
      if (cmd.includes('seat_r')) return 'Подогрев\nпассажира';
      if (cmd.includes('windshield')) return 'Подогрев\nлобового';
      if (cmd.includes('rearwindow')) return 'Подогрев\nзаднего';
      if (cmd.includes('vent_l')) return 'Вентиляция\nводителя';
      if (cmd.includes('vent_r')) return 'Вентиляция\nпассажира';
      if (cmd.includes('wheel')) return 'Подогрев\nруля';
      if (cmd.includes('voditel_1')) return 'Память\nводитель 1';
      if (cmd.includes('voditel_2')) return 'Память\nводитель 2';
      if (cmd.includes('voditel_3')) return 'Память\nводитель 3';
      return cmd;
    }

    async function loadCommands() {
      try {
        const listJson = android.getRunEnum();
        log("Climate commands JSON:", listJson);
        let all = [];
        try {
          all = JSON.parse(listJson);
        } catch (parseError) {
          warn("Failed to parse climate commands, using fallback", parseError);
          climateCommands = fallbackCommands.map(c => ({ ...c })); // копируем
          return;
        }

        const filtered = all.filter(cmd => 
          cmd.startsWith('heat_') || cmd.startsWith('vent_') || cmd.startsWith('voditel_')
        );

        if (filtered.length === 0) {
          warn("No climate commands found from API, using fallback");
          climateCommands = fallbackCommands.map(c => ({ ...c }));
          return;
        }

        climateCommands = filtered.map(cmd => {
          const base = { 
            cmd, 
            label: formatLabel(cmd), 
            max: cmd.includes('seat') ? 3 : 1 
          };
          // Добавляем особый off для заднего правого
          if (cmd === 'heat_zad_seat_r') base.off = 'heat_zad_seat_r_off';
          return base;
        });

        // Загружаем иконки
        for (let c of climateCommands) {
          try {
            const pic = android.getRunEnumPic(c.cmd);
            c.icon = pic ? `data:image/png;base64,${pic}` : 'icons/Default.svg';
          } catch { 
            c.icon = 'icons/Default.svg'; 
          }
        }
        log("Loaded climate commands:", climateCommands);
      } catch (e) {
        warn("Error loading climate commands, using fallback", e);
        climateCommands = fallbackCommands.map(c => ({ ...c }));
      }
    }

    // Получить команду выключения для заданного cmd
    function getOffCommand(cmdObj) {
      if (cmdObj.off) return cmdObj.off;
      return `${cmdObj.cmd}_0`;
    }

    function renderSlot(slot) {
      const slotId = slot.dataset.climateSlot;
      const savedCmd = storage.load(`climate_slot_${slotId}`);
      slot.innerHTML = "";
      if (!savedCmd) {
        slot.innerHTML = `<span style="font-size:1.5rem;opacity:0.5;">+</span>`;
        slot.classList.remove("active");
        return;
      }
      const cmdObj = climateCommands.find(c => c.cmd === savedCmd);
      if (!cmdObj) return;
      const level = climateState[savedCmd] || 0;
      const max = cmdObj.max || 1;
      const dots = Array.from({ length: max }, (_, i) => `<span class="climate-dot${i < level ? ' on' : ''}"></span>`).join('');
      slot.innerHTML = `<img src="${cmdObj.icon}"><div class="climate-label">${cmdObj.label.replace(/\\n/g, '<br>')}</div><div class="climate-dots">${dots}</div>`;
      slot.classList.toggle("active", level > 0);
    }

    function updateAllSlots() {
      document.querySelectorAll(".climate_slot").forEach(renderSlot);
    }

    function requestStatusForCommand(cmd) {
      android.requestClimateStateForCommand(cmd);
    }

    function syncFromCar() {
      const activeCmds = new Set();
      for (let i = 1; i <= 4; i++) {
        const cmd = storage.load(`climate_slot_${i}`);
        if (cmd) activeCmds.add(cmd);
      }
      if (window.androidApi?.requestClimateState) {
        android.requestClimateState();
      } else {
        activeCmds.forEach(cmd => requestStatusForCommand(cmd));
      }
    }

    function turnOffAll() {
      for (let i = 1; i <= 4; i++) {
        const savedCmd = storage.load(`climate_slot_${i}`);
        if (!savedCmd) continue;
        const cmdObj = climateCommands.find(c => c.cmd === savedCmd);
        if (!cmdObj) continue;
        const offCmd = getOffCommand(cmdObj);
        android.runEnum(offCmd);
        climateState[savedCmd] = 0;
      }
      updateAllSlots();
    }

    function updateState(data) {
      if (typeof data === "string") data = JSON.parse(data);
      for (let key in data) {
        let value = data[key];
        const match = key.match(/^(.+)_(\d+)$/);
        if (match) {
          const baseCmd = match[1];
          const level = parseInt(match[2], 10);
          const cmdObj = climateCommands.find(c => c.cmd === baseCmd);
          if (cmdObj) {
            climateState[baseCmd] = level;
            continue;
          }
        }
        // Обработка специального off для заднего правого (если пришло heat_zad_seat_r_off)
        if (key === 'heat_zad_seat_r_off') {
          climateState['heat_zad_seat_r'] = 0;
          continue;
        }
        const cmdObj = climateCommands.find(c => c.cmd === key);
        if (cmdObj) climateState[key] = value;
      }
      updateAllSlots();
    }

    function initPicker() {
      const picker = document.getElementById("climate-picker");
      const grid = document.getElementById("climate-picker-grid");
      const close = document.getElementById("climate-picker-close");
      let curSlotId = null;

      function openPicker(slotId) {
        curSlotId = slotId;
        grid.innerHTML = "";
        if (climateCommands.length === 0) {
          grid.innerHTML = `<div style="grid-column:1/-1;padding:20px;text-align:center;">Нет доступных функций</div>`;
          picker.classList.add("open");
          return;
        }
        climateCommands.forEach(cmd => {
          const d = document.createElement("div");
          d.className = "picker-item";
          d.innerHTML = `<img src="${cmd.icon}"><span>${cmd.label.replace(/\\n/g, ' ')}</span>`;
          d.onclick = () => {
            storage.save(`climate_slot_${curSlotId}`, cmd.cmd);
            climateState[cmd.cmd] = 0;
            updateAllSlots();
            picker.classList.remove("open");
            requestStatusForCommand(cmd.cmd);
          };
          grid.appendChild(d);
        });
        picker.classList.add("open");
      }

      close?.addEventListener("click", () => picker.classList.remove("open"));
      picker.addEventListener("click", e => { if (e.target === picker) picker.classList.remove("open"); });

      document.querySelectorAll(".climate_slot").forEach(slot => {
        const slotId = slot.dataset.climateSlot;
        makeLongPressable(slot, () => openPicker(slotId), { delay: 700 });

        slot.addEventListener('click', (e) => {
          if (e.detail === 0) return;
          const savedCmd = storage.load(`climate_slot_${slotId}`);
          if (!savedCmd) { openPicker(slotId); return; }
          const cmdObj = climateCommands.find(c => c.cmd === savedCmd);
          if (!cmdObj) return;
          const max = cmdObj.max || 1;
          const current = climateState[savedCmd] || 0;
          const next = (current + 1) % (max + 1);
          climateState[savedCmd] = next;
          let cmdToSend;
          if (next === 0) {
            cmdToSend = getOffCommand(cmdObj);
          } else {
            cmdToSend = max > 1 ? `${savedCmd}_${next}` : savedCmd;
          }
          android.runEnum(cmdToSend);
          renderSlot(slot);
        });
      });
    }

    async function init() {
      await loadCommands();
      initPicker();
      updateAllSlots();
      syncFromCar();
      document.getElementById("climateOffAll")?.addEventListener("click", turnOffAll);
    }

    return { init, updateState };
  })();

  // --- Приложения ---
  modules.apps = (function() {
    function init() {
      const slots = document.querySelectorAll(".app_slot");
      const picker = document.getElementById("app_picker");
      const grid = document.getElementById("app-picker-grid");
      const close = document.getElementById("app-picker-close");

      slots.forEach(s => {
        const saved = storage.load("app_slot_"+s.dataset.slot);
        if (saved) s.innerHTML = `<img src="data:image/png;base64,${saved.icon}">`;
      });

      let currentSlot = null;

      function openPicker(slot) {
        currentSlot = slot.dataset.slot;
        grid.innerHTML = `<div style="grid-column:1/-1;padding:20px;text-align:center;">Загрузка...</div>`;
        picker.classList.add("open");
        setTimeout(() => {
          grid.innerHTML = "";
          try {
            const apps = JSON.parse(android.getUserApps());
            apps.forEach(app => {
              const d = document.createElement("div");
              d.className = "picker-item";
              d.innerHTML = `<img src="data:image/png;base64,${app.icon}"><span>${app.name}</span>`;
              d.onclick = () => {
                storage.save("app_slot_"+currentSlot, {package: app.package, name: app.name, icon: app.icon});
                document.querySelector(`.app_slot[data-slot="${currentSlot}"]`).innerHTML = `<img src="data:image/png;base64,${app.icon}">`;
                picker.classList.remove("open");
              };
              grid.appendChild(d);
            });
          } catch(e) {
            grid.innerHTML = `<div style="padding:20px;text-align:center;">Ошибка загрузки приложений</div>`;
            error("Failed to load apps:", e);
          }
        }, 10);
      }

      close?.addEventListener("click", () => picker.classList.remove("open"));
      picker.addEventListener("click", e => { if (e.target === picker) picker.classList.remove("open"); });

      slots.forEach(slot => {
        makeLongPressable(slot, () => openPicker(slot), { delay: 700 });
        slot.addEventListener('click', (e) => {
          if (e.detail === 0) return;
          const app = storage.load("app_slot_"+slot.dataset.slot);
          if (!app) openPicker(slot);
          else android.runApp(app.package);
        });
      });
    }

    return { init };
  })();

  // --- Сеть ---
  modules.network = (function() {
    let online = false;
    let checking = false;
    const networkIcon = document.getElementById("networkIconContainer");
    const btn = document.getElementById("btnNetwork");
    let checkInterval = null;

    function setStatus(isOnline) {
      online = isOnline;
      if (!networkIcon) return;
      if (isOnline) {
        networkIcon.innerHTML = `
          <svg class="network-svg" viewBox="0 0 24 24" fill="none">
            <path d="M12 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm4.95-5.95c-1.6-1.6-3.1-2.3-4.95-2.3s-3.35.7-4.95 2.3l1.4 1.4c1.3-1.3 2.5-1.7 3.55-1.7s2.25.4 3.55 1.7l1.4-1.4zm3.15-3.95C17.8 5.8 15.1 4.75 12 4.75S6.2 5.8 3.9 8.1l1.4 1.4c2-2 4.3-2.75 6.7-2.75s4.7.75 6.7 2.75l1.4-1.4zm3.1-3.9C19.9.9 16.1-.5 12-.5S4.1.9.8 4.2l1.4 1.4c3-3 6.3-4.1 9.8-4.1s6.8 1.1 9.8 4.1l1.4-1.4z" fill="#4CAF50"/>
          </svg>
        `;
        btn.title = "Подключение к интернету есть";
      } else {
        networkIcon.innerHTML = `
          <svg class="network-svg" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#F44336" stroke-width="1.5" fill="none"/>
            <path d="M8 8l8 8M16 8l-8 8" stroke="#F44336" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        `;
        btn.title = "Нет подключения к интернету";
      }
    }

    function showChecking() {
      if (!networkIcon) return;
      networkIcon.innerHTML = `
        <svg class="network-svg" viewBox="0 0 24 24" fill="none">
          <path class="wifi-bar" d="M12 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" fill="#4CAF50" opacity="0.3">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" begin="0s" repeatCount="indefinite" />
          </path>
          <path class="wifi-bar" d="M16.95 12.05c-1.6-1.6-3.1-2.3-4.95-2.3s-3.35.7-4.95 2.3l1.4 1.4c1.3-1.3 2.5-1.7 3.55-1.7s2.25.4 3.55 1.7l1.4-1.4z" fill="#4CAF50" opacity="0.3">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" begin="0.2s" repeatCount="indefinite" />
          </path>
          <path class="wifi-bar" d="M20.1 8.1C17.8 5.8 15.1 4.75 12 4.75S6.2 5.8 3.9 8.1l1.4 1.4c2-2 4.3-2.75 6.7-2.75s4.7.75 6.7 2.75l1.4-1.4z" fill="#4CAF50" opacity="0.3">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" begin="0.4s" repeatCount="indefinite" />
          </path>
          <path class="wifi-bar" d="M23.2 4.2C19.9.9 16.1-.5 12-.5S4.1.9.8 4.2l1.4 1.4c3-3 6.3-4.1 9.8-4.1s6.8 1.1 9.8 4.1l1.4-1.4z" fill="#4CAF50" opacity="0.3">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" begin="0.6s" repeatCount="indefinite" />
          </path>
        </svg>
      `;
      btn.title = "Проверка подключения...";
    }

    function checkConnectivity() {
      if (checking) return;
      checking = true;
      showChecking();

      const testImg = new Image();
      const timeout = setTimeout(() => {
        testImg.src = "";
        setStatus(false);
        checking = false;
      }, 5000);

      testImg.onload = () => {
        clearTimeout(timeout);
        setStatus(true);
        checking = false;
      };
      testImg.onerror = () => {
        clearTimeout(timeout);
        setStatus(false);
        checking = false;
      };
      testImg.src = "https://yandex.ru/favicon.ico?_=" + Date.now();
    }

    function updateStatus() {
      if (!navigator.onLine) {
        setStatus(false);
        return;
      }
      checkConnectivity();
    }

    function init() {
      updateStatus();
      btn.addEventListener("click", () => { if (!checking) checkConnectivity(); });
      window.addEventListener("online", () => { setStatus(true); checkConnectivity(); });
      window.addEventListener("offline", () => setStatus(false));
      checkInterval = setInterval(checkConnectivity, 120000);
    }

    function destroy() {
      if (checkInterval) clearInterval(checkInterval);
    }

    return { init, destroy };
  })();

  // ---------- Обработка событий от Android ----------
  window.onAndroidEvent = function(type, data) {
    log("Android event:", type, data);
    if (type === "musicInfo") {
      modules.player.updateMusicInfo(data);
    } else if (type === "climateState") {
      modules.climate.updateState(data);
    }
  };

  // ---------- Инициализация интерфейса ----------
  function initUI() {
    modules.wallpaper.restore();
    modules.wallpaper.initAutoMode();
    modules.clock.start();
    modules.draggableNetwork.init();
    modules.brandEditor.init();
    modules.player.init();
    modules.apps.init();
    modules.network.init();

    document.getElementById("btnClose")?.addEventListener("click", () => android.onClose());
    document.getElementById("btnSettings")?.addEventListener("click", () => android.onSettings());

    const btnWallpaper = document.getElementById("btnWallpaper");
    btnWallpaper?.addEventListener("click", () => {
      modules.wallpaper.toggle();
      btnWallpaper.classList.toggle("active", storage.load("wallpaperMode") === "auto");
    });
    if (storage.load("wallpaperMode") === "auto") btnWallpaper?.classList.add("active");

    document.body.addEventListener("click", e => {
      if (e.target === document.body) {
        const mode = storage.load("wallpaperMode");
        if (mode === "auto") modules.wallpaper.setAuto(true);
        else if (mode === "custom") modules.wallpaper.nextCustom();
      }
    });

    const sidebar = document.getElementById("sidebar");
    document.getElementById("openSidebar")?.addEventListener("click", () => sidebar.classList.add("open"));
    document.getElementById("closeSidebar")?.addEventListener("click", () => sidebar.classList.remove("open"));
    document.querySelectorAll(".wallpaper-item").forEach((item, i) => {
      item.addEventListener("click", () => {
        modules.wallpaper.setCustomByIndex(i);
        sidebar.classList.remove("open");
      });
    });

    document.querySelector('.widget_time')?.addEventListener('click', modules.wallpaper.toggle);

    document.addEventListener("contextmenu", e => e.preventDefault());

    android.onJsReady();
  }

  async function start() {
    await modules.climate.init();
    initUI();
  }

  return { start };
})();

document.addEventListener("DOMContentLoaded", () => App.start());