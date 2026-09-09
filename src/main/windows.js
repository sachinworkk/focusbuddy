const path = require('path');
const { BrowserWindow, screen, app } = require('electron');
const { getWidgetPosition, setWidgetPosition } = require('./store');

const WIDGET_SIZE = 120;
const PANEL_SIZE = { width: 340, height: 560 };
const BUBBLE_SIZE = { width: 220, height: 110 };
const BUBBLE_GAP = 8;

let widgetWindow = null;
let panelWindow = null;
let panelReady = false;
let bubbleWindow = null;

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
    if (bubbleWindow && bubbleWindow.isVisible()) positionBubbleWindow();
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

function createBubbleWindow() {
  bubbleWindow = new BrowserWindow({
    width: BUBBLE_SIZE.width,
    height: BUBBLE_SIZE.height,
    show: false,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'bubble-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  bubbleWindow.setAlwaysOnTop(true, 'screen-saver');
  bubbleWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  bubbleWindow.setIgnoreMouseEvents(true);
  bubbleWindow.loadFile(path.join(__dirname, '..', 'renderer', 'bubble', 'index.html'));

  bubbleWindow.on('closed', () => {
    bubbleWindow = null;
  });

  return bubbleWindow;
}

// Positions the standalone bubble window relative to the widget's current
// bounds, flipping to whichever side/edge still has room on the display —
// this only ever moves the bubble window, never the widget, so dragging the
// avatar is unaffected regardless of where the bubble ends up.
function positionBubbleWindow() {
  if (!widgetWindow || !bubbleWindow) return;
  const widgetBounds = widgetWindow.getBounds();
  const display = screen.getDisplayMatching(widgetBounds) ?? screen.getPrimaryDisplay();
  const { x: areaX, y: areaY, width: areaWidth } = display.workArea;

  const avatarCenterX = widgetBounds.x + widgetBounds.width / 2;

  let x = avatarCenterX - BUBBLE_SIZE.width / 2;
  x = clamp(x, areaX, areaX + areaWidth - BUBBLE_SIZE.width);
  const tailOffsetX = clamp(avatarCenterX - x, 12, BUBBLE_SIZE.width - 12);

  let y = widgetBounds.y - BUBBLE_SIZE.height - BUBBLE_GAP;
  let flipped = false;
  if (y < areaY) {
    y = widgetBounds.y + widgetBounds.height + BUBBLE_GAP;
    flipped = true;
  }

  bubbleWindow.setBounds({ x: Math.round(x), y: Math.round(y), width: BUBBLE_SIZE.width, height: BUBBLE_SIZE.height });
  bubbleWindow.webContents.send('bubble:update', { tailOffsetX, flipped });
}

let bubbleText = null;

function showBubble(text) {
  if (!widgetWindow) return;
  if (!bubbleWindow) createBubbleWindow();

  const send = () => {
    positionBubbleWindow();
    // Only (re-)send the text when it actually changes, otherwise the
    // bubble's fade-in CSS transition restarts every render tick while the
    // avatar is hovered, causing a visible flicker.
    if (text !== bubbleText) {
      bubbleText = text;
      bubbleWindow.webContents.send('bubble:set-text', text);
    }
    if (!bubbleWindow.isVisible()) bubbleWindow.showInactive();
  };

  if (bubbleWindow.webContents.isLoading()) {
    bubbleWindow.webContents.once('did-finish-load', send);
  } else {
    send();
  }
}

function hideBubble() {
  bubbleText = null;
  if (bubbleWindow) bubbleWindow.hide();
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

  const avatarBottom = widgetBounds.y + widgetBounds.height;

  let anchorSide = 'left';
  let x = widgetBounds.x - PANEL_SIZE.width - 12;
  if (x < 0) {
    x = widgetBounds.x + widgetBounds.width + 12;
    anchorSide = 'right';
  }
  if (x + PANEL_SIZE.width > screenWidth) x = screenWidth - PANEL_SIZE.width - 12;

  let y = avatarBottom - PANEL_SIZE.height;
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
  showBubble,
  hideBubble,
};
