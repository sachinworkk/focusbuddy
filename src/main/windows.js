const path = require('path');
const { BrowserWindow, screen, app } = require('electron');
const { getWidgetPosition, setWidgetPosition } = require('./store');

const WIDGET_SIZE = 120;
const PANEL_SIZE = { width: 340, height: 560 };

let widgetWindow = null;
let panelWindow = null;
let panelReady = false;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createWidgetWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  const defaultX = screenWidth - WIDGET_SIZE - 24;
  const defaultY = screenHeight - WIDGET_SIZE - 24;
  const saved = getWidgetPosition();
  const x = clamp(saved?.x ?? defaultX, 0, screenWidth - WIDGET_SIZE);
  const y = clamp(saved?.y ?? defaultY, 0, screenHeight - WIDGET_SIZE);

  widgetWindow = new BrowserWindow({
    width: WIDGET_SIZE,
    height: WIDGET_SIZE,
    x,
    y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'widget-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  widgetWindow.setAlwaysOnTop(true, 'screen-saver');
  widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  widgetWindow.loadFile(path.join(__dirname, '..', 'renderer', 'widget', 'index.html'));

  let savePositionTimer = null;
  widgetWindow.on('move', () => {
    clearTimeout(savePositionTimer);
    savePositionTimer = setTimeout(() => {
      const bounds = widgetWindow.getBounds();
      setWidgetPosition(bounds.x, bounds.y);
    }, 400);
  });

  widgetWindow.on('closed', () => {
    clearTimeout(savePositionTimer);
    widgetWindow = null;
  });

  return widgetWindow;
}

function createPanelWindow() {
  panelWindow = new BrowserWindow({
    width: PANEL_SIZE.width,
    height: PANEL_SIZE.height,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    title: 'FocusBuddy',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'panel-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  panelWindow.loadFile(path.join(__dirname, '..', 'renderer', 'panel', 'index.html'));

  panelWindow.once('ready-to-show', () => {
    panelReady = true;
  });

  panelWindow.on('close', (event) => {
    if (app.isQuitting) return;
    event.preventDefault();
    panelWindow.hide();
  });

  return panelWindow;
}

function positionPanelNearWidget() {
  if (!widgetWindow || !panelWindow) return;
  const widgetBounds = widgetWindow.getBounds();
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  let anchorSide = 'left';
  let x = widgetBounds.x - PANEL_SIZE.width - 12;
  if (x < 0) {
    x = widgetBounds.x + WIDGET_SIZE + 12;
    anchorSide = 'right';
  }
  if (x + PANEL_SIZE.width > screenWidth) x = screenWidth - PANEL_SIZE.width - 12;

  let y = widgetBounds.y + WIDGET_SIZE - PANEL_SIZE.height;
  if (y < 0) y = 0;
  if (y + PANEL_SIZE.height > screenHeight) y = screenHeight - PANEL_SIZE.height;

  panelWindow.setBounds({ x, y, width: PANEL_SIZE.width, height: PANEL_SIZE.height });
  return anchorSide;
}

function togglePanelWindow() {
  if (!panelWindow) {
    createPanelWindow();
  }

  if (panelWindow.isVisible()) {
    panelWindow.hide();
    return;
  }

  const showPanel = () => {
    const anchorSide = positionPanelNearWidget();
    panelWindow.webContents.send('panel:will-show', anchorSide);
    panelWindow.show();
  };

  if (panelReady) {
    showPanel();
  } else {
    panelWindow.once('ready-to-show', showPanel);
  }
}

function getWidgetWindow() {
  return widgetWindow;
}

function getPanelWindow() {
  return panelWindow;
}

module.exports = {
  createWidgetWindow,
  createPanelWindow,
  togglePanelWindow,
  getWidgetWindow,
  getPanelWindow,
};
