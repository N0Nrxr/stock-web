const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Stock Monitor",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: false // ปิดใช้งาน DevTools
    }
  });

  // ซ่อนแถบเมนู File Edit View Window ด้านบน
  win.removeMenu();

  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});