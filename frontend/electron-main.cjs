const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'public', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: 'СИЯНИЕ OS',
    backgroundColor: '#050a0c',
    autoHideMenuBar: true // Скрывает верхнее меню Windows
  });

  if (isDev) {
    // В режиме разработки загружаем из Vite сервера
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    // В финальной сборке загружаем собранные файлы Vite
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});