const { app, BrowserWindow, Menu, shell, dialog, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const APP_NAME = 'QG14 CARDCLASH';
const DEFAULT_PORT = 38414;

let mainWindow = null;
let localOrigin = '';
let lanOrigin = '';
let cardLibraryRoot = '';
let dataRoot = '';
let settingsPath = '';
let serverModule = null;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readJson(file, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function getLanIPv4() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (!entry || entry.internal || entry.family !== 'IPv4') continue;
      candidates.push(entry.address);
    }
  }

  const privateFirst = candidates.find((ip) =>
    /^192\.168\./.test(ip) ||
    /^10\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );

  return privateFirst || candidates[0] || '127.0.0.1';
}

function getBundledPublicRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'public');
  }
  return path.join(__dirname, 'public');
}

function getDefaultsRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'defaults');
  }
  return __dirname;
}

function seedFileIfMissing(target, source, fallbackText) {
  if (fs.existsSync(target)) return;
  ensureDir(path.dirname(target));

  try {
    if (source && fs.existsSync(source)) {
      fs.copyFileSync(source, target);
      return;
    }
  } catch (err) {
    console.warn('[desktop] seed copy failed:', err.message);
  }

  fs.writeFileSync(target, fallbackText, 'utf8');
}

function ensureCardLibraryStructure(root) {
  const folders = [
    ['public', 'images', 'normal'],
    ['public', 'images', 'legendary'],
    ['public', 'images', 'fullscreen'],
    ['public', 'anime', 'images', 'normal'],
    ['public', 'anime', 'images', 'legendary'],
    ['public', 'anime', 'images', 'fullscreen'],
  ];

  for (const parts of folders) {
    ensureDir(path.join(root, ...parts));
  }
}

function loadDesktopSettings() {
  dataRoot = ensureDir(app.getPath('userData'));
  settingsPath = path.join(dataRoot, 'desktop-settings.json');

  const defaultLibrary = path.join(app.getPath('documents'), 'QG14 CARDCLASH Library');
  const existing = readJson(settingsPath, null);
  const firstRun = !existing;

  const settings = {
    adminUsername: 'qg14',
    adminPassword: 'qg14',
    port: DEFAULT_PORT,
    cardLibraryRoot: defaultLibrary,
    firebaseServiceAccountPath: '',
    ...(existing || {}),
  };

  settings.port = Number.isInteger(Number(settings.port))
    ? Math.min(65535, Math.max(1024, Number(settings.port)))
    : DEFAULT_PORT;

  settings.cardLibraryRoot = path.resolve(settings.cardLibraryRoot || defaultLibrary);
  writeJson(settingsPath, settings);

  return { settings, firstRun };
}

function ensureSessionSecret() {
  const secretPath = path.join(dataRoot, 'session-secret.txt');
  if (fs.existsSync(secretPath)) {
    const existing = fs.readFileSync(secretPath, 'utf8').trim();
    if (existing) return existing;
  }

  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(secretPath, secret, 'utf8');
  return secret;
}

function configureEnvironment(settings) {
  cardLibraryRoot = settings.cardLibraryRoot;
  ensureCardLibraryStructure(cardLibraryRoot);

  const defaultsRoot = getDefaultsRoot();
  const abilitiesPath = path.join(dataRoot, 'abilities.json');
  const leaderboardPath = path.join(dataRoot, 'leaderboard.json');

  seedFileIfMissing(
    abilitiesPath,
    path.join(defaultsRoot, 'abilities.json'),
    JSON.stringify({ abilities: [] }, null, 2)
  );
  seedFileIfMissing(
    leaderboardPath,
    path.join(defaultsRoot, 'leaderboard.json'),
    JSON.stringify({ players: {} }, null, 2)
  );

  process.env.QG14_DESKTOP = '1';
  process.env.QG14_PUBLIC_ROOT = getBundledPublicRoot();
  process.env.QG14_CARD_LIBRARY_ROOT = cardLibraryRoot;
  process.env.ABILITIES_PATH = abilitiesPath;
  process.env.LEADERBOARD_PATH = leaderboardPath;
  process.env.PORT = String(settings.port);
  process.env.HOST = '0.0.0.0';
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || ensureSessionSecret();
  process.env.USERNAME = process.env.USERNAME || String(settings.adminUsername || 'qg14');
  process.env.PASSWORD = process.env.PASSWORD || String(settings.adminPassword || 'qg14');
  process.env.SOCKET_ALLOW_PUBLIC = 'true';
  process.env.ALLOWED_IPV4S = '';

  const firebasePath = String(settings.firebaseServiceAccountPath || '').trim();
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY && firebasePath && fs.existsSync(firebasePath)) {
    try {
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY = fs.readFileSync(firebasePath, 'utf8');
    } catch (err) {
      console.warn('[desktop] Firebase service account could not be read:', err.message);
    }
  }

  const lanIp = getLanIPv4();
  localOrigin = `http://127.0.0.1:${settings.port}`;
  lanOrigin = `http://${lanIp}:${settings.port}`;
}

function rewriteCopiedLocalLinks(win) {
  if (!win || win.isDestroyed()) return;
  const safeLan = JSON.stringify(lanOrigin);

  const script = `(() => {
    const LAN_ORIGIN = ${safeLan};
    const LOCAL_ORIGINS = [location.origin, 'http://127.0.0.1:${process.env.PORT}', 'http://localhost:${process.env.PORT}'];
    const rewrite = (value) => {
      let text = String(value ?? '');
      for (const origin of LOCAL_ORIGINS) {
        if (origin && text.includes(origin)) text = text.split(origin).join(LAN_ORIGIN);
      }
      return text;
    };

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && !navigator.clipboard.__qg14Wrapped) {
        const original = navigator.clipboard.writeText.bind(navigator.clipboard);
        const wrapped = (text) => original(rewrite(text));
        Object.defineProperty(wrapped, '__qg14Wrapped', { value: true });
        navigator.clipboard.writeText = wrapped;
        navigator.clipboard.__qg14Wrapped = true;
      }
    } catch {}

    document.addEventListener('copy', (event) => {
      try {
        const active = document.activeElement;
        const value = active && typeof active.value === 'string' ? active.value : '';
        if (!value) return;
        const rewritten = rewrite(value);
        if (rewritten !== value && event.clipboardData) {
          event.preventDefault();
          event.clipboardData.setData('text/plain', rewritten);
        }
      } catch {}
    }, true);

    window.__QG14_DESKTOP__ = true;
    window.__QG14_LAN_ORIGIN__ = LAN_ORIGIN;
  })();`;

  win.webContents.executeJavaScript(script, true).catch(() => {});
}

function createBrowserWindow(url = localOrigin, parent = null) {
  const win = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1050,
    minHeight: 700,
    show: false,
    backgroundColor: '#180309',
    autoHideMenuBar: false,
    parent: parent || undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url: requestedUrl }) => {
    try {
      const parsed = new URL(requestedUrl);
      const local = new URL(localOrigin);
      const lan = new URL(lanOrigin);
      const isGameUrl =
        (parsed.hostname === local.hostname || parsed.hostname === lan.hostname) &&
        parsed.port === local.port;

      if (isGameUrl) {
        const localUrl = `${localOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
        createBrowserWindow(localUrl, win);
      } else {
        shell.openExternal(requestedUrl);
      }
    } catch {
      shell.openExternal(requestedUrl).catch(() => {});
    }
    return { action: 'deny' };
  });

  win.webContents.on('did-finish-load', () => rewriteCopiedLocalLinks(win));
  win.once('ready-to-show', () => win.show());
  win.loadURL(url);
  return win;
}

function persistLibraryRoot(newRoot) {
  const settings = readJson(settingsPath, {});
  settings.cardLibraryRoot = path.resolve(newRoot);
  writeJson(settingsPath, settings);
}

async function chooseCardLibrary() {
  const result = await dialog.showOpenDialog(mainWindow || undefined, {
    title: 'اختر المجلد الرئيسي لمكتبة QG14',
    defaultPath: cardLibraryRoot,
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'استخدام هذا المجلد',
  });

  if (result.canceled || !result.filePaths[0]) return;
  const selected = result.filePaths[0];
  ensureCardLibraryStructure(selected);
  persistLibraryRoot(selected);

  const answer = await dialog.showMessageBox(mainWindow || undefined, {
    type: 'info',
    buttons: ['إعادة التشغيل الآن', 'لاحقًا'],
    defaultId: 0,
    title: APP_NAME,
    message: 'تم تغيير مكتبة الكروت.',
    detail: 'يحتاج البرنامج إلى إعادة تشغيل لاستخدام المسار الجديد.',
  });

  if (answer.response === 0) {
    app.relaunch();
    app.exit(0);
  }
}

function buildMenu() {
  const template = [
    {
      label: 'QG14',
      submenu: [
        {
          label: 'فتح مجلد الكروت',
          click: () => shell.openPath(cardLibraryRoot),
        },
        {
          label: 'تغيير مجلد الكروت...',
          click: () => chooseCardLibrary(),
        },
        {
          label: 'فتح مجلد بيانات البرنامج',
          click: () => shell.openPath(dataRoot),
        },
        {
          label: 'فتح ملف إعدادات البرنامج',
          click: () => shell.openPath(settingsPath),
        },
        { type: 'separator' },
        {
          label: 'نسخ رابط الشبكة',
          click: () => clipboard.writeText(lanOrigin),
        },
        {
          label: 'عرض معلومات الشبكة',
          click: () => dialog.showMessageBox(mainWindow || undefined, {
            type: 'info',
            title: APP_NAME,
            message: 'رابط البرنامج على الشبكة المحلية',
            detail: `${lanOrigin}\n\nأجهزة اللاعبين يجب أن تكون على نفس الشبكة.`,
          }),
        },
        { type: 'separator' },
        { role: 'quit', label: 'خروج' },
      ],
    },
    {
      label: 'عرض',
      submenu: [
        { role: 'reload', label: 'تحديث الصفحة' },
        { role: 'forceReload', label: 'تحديث كامل' },
        { role: 'toggleDevTools', label: 'أدوات المطور' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'الحجم الافتراضي' },
        { role: 'zoomIn', label: 'تكبير' },
        { role: 'zoomOut', label: 'تصغير' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'ملء الشاشة' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function boot() {
  const { settings, firstRun } = loadDesktopSettings();
  configureEnvironment(settings);

  // Require the server only after all desktop environment values are ready.
  serverModule = require('./index.js');

  try {
    await serverModule.startServer();
  } catch (err) {
    const isPortBusy = err && err.code === 'EADDRINUSE';
    await dialog.showMessageBox({
      type: 'error',
      title: APP_NAME,
      message: isPortBusy ? `المنفذ ${settings.port} مستخدم بالفعل.` : 'تعذر تشغيل خادم QG14 المحلي.',
      detail: isPortBusy
        ? 'أغلق النسخة الأخرى من البرنامج أو غيّر port في desktop-settings.json ثم أعد التشغيل.'
        : String(err?.stack || err?.message || err),
    });
    app.quit();
    return;
  }

  buildMenu();
  mainWindow = createBrowserWindow(localOrigin);

  if (firstRun) {
    mainWindow.once('ready-to-show', async () => {
      await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: APP_NAME,
        message: 'تم تجهيز نسخة QG14 للكمبيوتر.',
        detail:
          `بيانات الدخول الافتراضية:\nاسم المستخدم: ${settings.adminUsername}\nكلمة المرور: ${settings.adminPassword}\n\n` +
          `مكتبة الكروت:\n${cardLibraryRoot}\n\n` +
          'يمكن تغيير هذه القيم من قائمة QG14 > فتح ملف إعدادات البرنامج، ثم إعادة تشغيل البرنامج.',
      });
    });
  }
}

app.whenReady().then(boot);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && localOrigin) {
    mainWindow = createBrowserWindow(localOrigin);
  }
});

app.on('before-quit', () => {
  try {
    if (serverModule && serverModule.server?.listening) {
      serverModule.server.close();
    }
  } catch {}
});
