const { EventEmitter } = require('events');

const emitter = new EventEmitter();

let status = 'idle'; // idle | running | paused | completed
let durationSeconds = 0;
let remainingSeconds = 0;
let task = null; // { id, title, ... } | null
let intervalId = null;
let startedAt = null; // ISO string, set on start()
let markTaskComplete = false;

function getState() {
  return { status, durationSeconds, remainingSeconds, task };
}

function emitChange() {
  emitter.emit('change', getState());
}

function tick() {
  remainingSeconds -= 1;
  if (remainingSeconds <= 0) {
    remainingSeconds = 0;
    status = 'completed';
    clearInterval(intervalId);
    intervalId = null;
    emitChange();
    emitter.emit('completed', {
      task,
      durationSeconds,
      startedAt,
      endedAt: new Date().toISOString(),
      markTaskComplete,
    });
    return;
  }
  emitChange();
}

function start(minutes, selectedTask = null, options = {}) {
  clearInterval(intervalId);
  durationSeconds = Math.max(1, Math.round(Number(minutes) * 60));
  remainingSeconds = durationSeconds;
  task = selectedTask;
  markTaskComplete = !!options.markTaskComplete;
  status = 'running';
  startedAt = new Date().toISOString();
  intervalId = setInterval(tick, 1000);
  emitChange();
  return getState();
}

function pause() {
  if (status === 'running') {
    clearInterval(intervalId);
    intervalId = null;
    status = 'paused';
    emitChange();
  }
  return getState();
}

function resume() {
  if (status === 'paused') {
    status = 'running';
    intervalId = setInterval(tick, 1000);
    emitChange();
  }
  return getState();
}

function reset() {
  clearInterval(intervalId);
  intervalId = null;
  status = 'idle';
  durationSeconds = 0;
  remainingSeconds = 0;
  task = null;
  markTaskComplete = false;
  emitChange();
  return getState();
}

function onChange(listener) {
  emitter.on('change', listener);
}

function onCompleted(listener) {
  emitter.on('completed', listener);
}

module.exports = { start, pause, resume, reset, getState, onChange, onCompleted };
