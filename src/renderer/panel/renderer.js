const ticktickStatusEl = document.getElementById('ticktick-status');
const connectBtn = document.getElementById('ticktick-connect-btn');
const logoutBtn = document.getElementById('ticktick-logout-btn');
const refreshTasksBtn = document.getElementById('refresh-tasks-btn');
const addTaskBtn = document.getElementById('add-task-btn');
const tasksStatusEl = document.getElementById('tasks-status');
const taskListEl = document.getElementById('task-list');
const timerTaskEl = document.getElementById('timer-task');
const timerDisplayEl = document.getElementById('timer-display');
const timerMinutesInput = document.getElementById('timer-minutes');
const timerStartBtn = document.getElementById('timer-start-btn');
const timerPauseBtn = document.getElementById('timer-pause-btn');
const timerResumeBtn = document.getElementById('timer-resume-btn');
const timerResetBtn = document.getElementById('timer-reset-btn');
const markCompleteCheckbox = document.getElementById('mark-complete-checkbox');
const blockSitesCheckbox = document.getElementById('block-sites-checkbox');
const sessionStatusEl = document.getElementById('session-status');
const blockingStatusEl = document.getElementById('blocking-status');
const unblockNowBtn = document.getElementById('unblock-now-btn');
const blockingDomainsHintEl = document.getElementById('blocking-domains-hint');
const defaultMinutesInput = document.getElementById('default-minutes-input');
const defaultMarkCompleteCheckbox = document.getElementById('default-mark-complete-checkbox');
const defaultBlockSitesCheckbox = document.getElementById('default-block-sites-checkbox');
const settingsSavedHintEl = document.getElementById('settings-saved-hint');
const settingsSection = document.getElementById('settings-section');
const settingsToggleBtn = document.getElementById('settings-toggle-btn');

let selectedTaskId = null;
let currentTasks = [];
let currentTimerState = null;
let cachedProjects = null;
let subtaskDialogTaskId = null;

async function getProjectOptions() {
  if (!cachedProjects) {
    const projects = await window.focusbuddy.ticktick.getProjects();
    cachedProjects = [{ id: 'inbox', name: 'Inbox' }, ...projects];
  }
  return cachedProjects;
}

function findSelectedTask() {
  for (const task of currentTasks) {
    if (task.id === selectedTaskId) return task;
    const sub = task.subtasks?.find((s) => s.id === selectedTaskId);
    if (sub) return { id: sub.id, projectId: sub.projectId, title: sub.title };
  }
  return null;
}

function updateIdleTaskLabel() {
  if (currentTimerState && currentTimerState.status !== 'idle') return;
  const selected = findSelectedTask();
  timerTaskEl.textContent = selected ? selected.title : 'No task selected';
}

function renderConnected(connected) {
  ticktickStatusEl.textContent = connected ? 'Connected to TickTick.' : 'Not connected to TickTick.';
  connectBtn.hidden = connected;
  logoutBtn.hidden = !connected;
  refreshTasksBtn.hidden = !connected;
  addTaskBtn.hidden = !connected;

  if (!connected) {
    taskListEl.hidden = true;
    taskListEl.innerHTML = '';
    tasksStatusEl.hidden = false;
    tasksStatusEl.textContent = 'Connect TickTick to see your tasks.';
    window.focusbuddy.avatar.setOverdueState(false);
  }
}

function isOverdue(task) {
  return Boolean(task.dueDate && new Date(task.dueDate) < new Date());
}

function updateOverdueState(tasks) {
  window.focusbuddy.avatar.setOverdueState(tasks.some(isOverdue));
}

function todayYMD() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function localDateTimeToTickTickISO(year, month, day, hour, minute) {
  return new Date(year, month - 1, day, hour, minute).toISOString().replace('Z', '+0000');
}

async function updateTaskDueDate(task, dueDateISO, isAllDay, startDateISO = dueDateISO) {
  const previousDueDate = task.dueDate;
  const previousStartDate = task.startDate;
  const previousIsAllDay = task.isAllDay;
  task.dueDate = dueDateISO;
  task.startDate = startDateISO;
  task.isAllDay = isAllDay;
  renderTasks(currentTasks);
  try {
    await window.focusbuddy.ticktick.updateDueDate(task.projectId, task.id, dueDateISO, isAllDay, startDateISO);
  } catch (err) {
    task.dueDate = previousDueDate;
    task.startDate = previousStartDate;
    task.isAllDay = previousIsAllDay;
    renderTasks(currentTasks);
    tasksStatusEl.hidden = false;
    tasksStatusEl.textContent = `Couldn't update due date for "${task.title}": ${err.message}`;
  }
}

function bucketTasksByDate(tasks) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfToday.getDate() + 1);

  const overdue = [];
  const today = [];
  const upcoming = [];
  const noDueDate = [];

  for (const task of tasks) {
    if (!task.dueDate) {
      noDueDate.push(task);
      continue;
    }
    const due = new Date(task.dueDate);
    const start = task.startDate ? new Date(task.startDate) : null;
    const isActiveRange = start && start < startOfTomorrow && due >= startOfToday;

    if (due < startOfToday) overdue.push(task);
    else if (due < startOfTomorrow) today.push(task);
    else if (isActiveRange) today.push(task);
    else upcoming.push(task);
  }

  const byDueDate = (a, b) => new Date(a.dueDate) - new Date(b.dueDate);
  overdue.sort(byDueDate);
  today.sort(byDueDate);
  upcoming.sort(byDueDate);

  return { overdue, today, upcoming, noDueDate };
}

function formatDueLabel(task, bucket) {
  const due = new Date(task.dueDate);
  if (bucket === 'today') {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfToday.getDate() + 1);
    const dueIsToday = due >= startOfToday && due < startOfTomorrow;
    if (!dueIsToday) {
      return `Due ${due.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    }
    return task.isAllDay ? 'All day' : due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (bucket === 'upcoming') {
    return task.isAllDay ? 'All day' : due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return '';
}

function closeDueEditor(control) {
  const backdrop = document.querySelector('.task-due-modal-backdrop');
  if (backdrop) backdrop.remove();
  control.classList.remove('editing');
}

function createDueDateFields({ initialDueDate = null, initialIsAllDay = false, onEnter, onEscape } = {}) {
  const pad = (n) => String(n).padStart(2, '0');

  const dateField = document.createElement('div');
  dateField.className = 'task-due-field';
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'task-due-input task-due-date-input';
  dateField.appendChild(dateInput);

  const timeField = document.createElement('div');
  timeField.className = 'task-due-field';
  const timeInput = document.createElement('input');
  timeInput.type = 'time';
  timeInput.className = 'task-due-input task-due-time-input';
  timeField.appendChild(timeInput);

  if (initialDueDate) {
    const due = new Date(initialDueDate);
    dateInput.value = `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}`;
    timeInput.value = initialIsAllDay ? '' : `${pad(due.getHours())}:${pad(due.getMinutes())}`;

    const clearDateBtn = document.createElement('button');
    clearDateBtn.type = 'button';
    clearDateBtn.className = 'link-btn task-due-clear-date-btn';
    clearDateBtn.textContent = 'Clear';
    clearDateBtn.addEventListener('click', () => {
      dateInput.value = '';
    });
    dateField.appendChild(clearDateBtn);

    const clearTimeBtn = document.createElement('button');
    clearTimeBtn.type = 'button';
    clearTimeBtn.className = 'link-btn task-due-clear-time-btn';
    clearTimeBtn.textContent = 'Clear';
    clearTimeBtn.addEventListener('click', () => {
      timeInput.value = '';
    });
    timeField.appendChild(clearTimeBtn);
  }

  const handleKeydown = (evt) => {
    if (evt.key === 'Enter' && onEnter) onEnter();
    if (evt.key === 'Escape' && onEscape) onEscape();
  };
  dateInput.addEventListener('keydown', handleKeydown);
  timeInput.addEventListener('keydown', handleKeydown);

  function getValue() {
    if (!dateInput.value) return null;
    const [year, month, day] = dateInput.value.split('-').map(Number);
    const isAllDay = !timeInput.value;
    const [hour, minute] = isAllDay ? [0, 0] : timeInput.value.split(':').map(Number);
    const iso = localDateTimeToTickTickISO(year, month, day, hour, minute);
    return { dueDateISO: iso, isAllDay, startDateISO: iso };
  }

  return { dateField, timeField, dateInput, timeInput, getValue };
}

function createDueControl(task, bucket) {
  const control = document.createElement('span');
  control.className = 'task-due-control';

  const label = document.createElement('button');
  label.type = 'button';
  label.className = 'link-btn task-due-label';
  label.textContent = bucket === 'noDueDate' ? '📅' : formatDueLabel(task, bucket);

  label.addEventListener('click', (event) => {
    event.stopPropagation();
    if (control.classList.contains('editing')) {
      closeDueEditor(control);
      return;
    }

    document.querySelectorAll('.task-due-control.editing').forEach((el) => closeDueEditor(el));

    const backdrop = document.createElement('div');
    backdrop.className = 'task-due-modal-backdrop';
    backdrop.addEventListener('click', () => closeDueEditor(control));

    const editor = document.createElement('div');
    editor.className = 'task-due-modal';
    editor.addEventListener('click', (evt) => evt.stopPropagation());

    const title = document.createElement('div');
    title.className = 'task-due-modal-title';
    title.textContent = task.title;
    editor.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'task-due-modal-actions';

    const mainActions = document.createElement('div');
    mainActions.className = 'task-due-modal-main-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'link-btn task-due-cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => closeDueEditor(control));

    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'task-due-ok-btn';
    okBtn.textContent = 'OK';

    const { dateField, timeField, dateInput, getValue } = createDueDateFields({
      initialDueDate: bucket === 'noDueDate' ? null : task.dueDate,
      initialIsAllDay: task.isAllDay,
      onEnter: () => okBtn.click(),
      onEscape: () => closeDueEditor(control),
    });

    okBtn.addEventListener('click', () => {
      const result = getValue();
      if (bucket === 'noDueDate' && !result) return;
      if (result) updateTaskDueDate(task, result.dueDateISO, result.isAllDay, result.startDateISO);
      else updateTaskDueDate(task, null, false, null);
      closeDueEditor(control);
    });

    editor.appendChild(dateField);
    editor.appendChild(timeField);

    mainActions.appendChild(cancelBtn);
    mainActions.appendChild(okBtn);
    actions.appendChild(mainActions);
    editor.appendChild(actions);

    backdrop.appendChild(editor);
    document.body.appendChild(backdrop);
    control.classList.add('editing');
    dateInput.focus();
  });

  control.appendChild(label);
  return control;
}

document.addEventListener('click', () => {
  document.querySelectorAll('.task-due-control.editing').forEach((el) => closeDueEditor(el));
});

function setBtnLoading(btn, loading) {
  if (loading) {
    btn.disabled = true;
    btn.classList.add('is-loading');
  } else {
    btn.disabled = false;
    btn.classList.remove('is-loading');
  }
}

function createLoadableButton(className, text) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  const label = document.createElement('span');
  label.className = 'btn-label-text';
  label.textContent = text;
  const spinner = document.createElement('span');
  spinner.className = 'btn-spinner';
  btn.appendChild(label);
  btn.appendChild(spinner);
  return btn;
}

function closeTaskFormEditor() {
  const backdrop = document.querySelector('.task-form-modal-backdrop');
  if (backdrop) backdrop.remove();
}

async function openTaskFormModal({ heading, initialTitle, initialProjectId, submitLabel, onSubmit, onDelete }) {
  document.querySelectorAll('.task-due-control.editing').forEach((el) => closeDueEditor(el));
  closeTaskFormEditor();

  const projects = await getProjectOptions();

  const backdrop = document.createElement('div');
  backdrop.className = 'task-due-modal-backdrop task-form-modal-backdrop';
  backdrop.addEventListener('click', closeTaskFormEditor);

  const editor = document.createElement('div');
  editor.className = 'task-due-modal task-form-modal';
  editor.addEventListener('click', (evt) => evt.stopPropagation());

  const titleRow = document.createElement('div');
  titleRow.className = 'task-form-title-row';

  const title = document.createElement('div');
  title.className = 'task-due-modal-title';
  title.textContent = heading;
  titleRow.appendChild(title);

  if (onDelete) {
    const deleteIconBtn = document.createElement('button');
    deleteIconBtn.type = 'button';
    deleteIconBtn.className = 'task-form-delete-icon-btn';
    deleteIconBtn.setAttribute('aria-label', 'Delete task');
    deleteIconBtn.textContent = '🗑';
    deleteIconBtn.addEventListener('click', () => openDeleteConfirmModal());
    titleRow.appendChild(deleteIconBtn);
  }

  editor.appendChild(titleRow);

  const titleField = document.createElement('div');
  titleField.className = 'task-due-field';
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'task-due-input task-form-title-input';
  titleInput.value = initialTitle || '';
  titleInput.placeholder = 'Task title';
  titleField.appendChild(titleInput);
  editor.appendChild(titleField);

  const projectField = document.createElement('div');
  projectField.className = 'task-due-field';
  const projectSelect = document.createElement('select');
  projectSelect.className = 'task-due-input task-form-project-select';
  for (const p of projects) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    if (p.id === initialProjectId) opt.selected = true;
    projectSelect.appendChild(opt);
  }
  projectField.appendChild(projectSelect);
  editor.appendChild(projectField);

  const actions = document.createElement('div');
  actions.className = 'task-due-modal-actions';
  const mainActions = document.createElement('div');
  mainActions.className = 'task-due-modal-main-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'link-btn task-due-cancel-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', closeTaskFormEditor);

  const okBtn = createLoadableButton('task-due-ok-btn', submitLabel);
  okBtn.addEventListener('click', async () => {
    const titleValue = titleInput.value.trim();
    if (!titleValue) return;
    setBtnLoading(okBtn, true);
    try {
      await onSubmit({ title: titleValue, projectId: projectSelect.value, due: dueFields.getValue() });
      closeTaskFormEditor();
    } catch (err) {
      setBtnLoading(okBtn, false);
      tasksStatusEl.hidden = false;
      tasksStatusEl.textContent = `Couldn't save task: ${err.message}`;
    }
  });

  const dueFields = createDueDateFields({
    onEnter: () => okBtn.click(),
    onEscape: closeTaskFormEditor,
  });
  editor.appendChild(dueFields.dateField);
  editor.appendChild(dueFields.timeField);

  titleInput.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter') okBtn.click();
    if (evt.key === 'Escape') closeTaskFormEditor();
  });

  mainActions.appendChild(cancelBtn);
  mainActions.appendChild(okBtn);

  actions.appendChild(mainActions);
  editor.appendChild(actions);

  function openDeleteConfirmModal() {
    const confirmBackdrop = document.createElement('div');
    confirmBackdrop.className = 'task-form-delete-modal-backdrop';
    confirmBackdrop.addEventListener('click', () => confirmBackdrop.remove());

    const confirmModal = document.createElement('div');
    confirmModal.className = 'task-due-modal task-form-delete-modal';
    confirmModal.addEventListener('click', (evt) => evt.stopPropagation());

    const confirmMsg = document.createElement('div');
    confirmMsg.className = 'task-form-delete-confirm-msg';
    confirmMsg.textContent = "Delete this task? This can't be undone.";
    confirmModal.appendChild(confirmMsg);

    const confirmActions = document.createElement('div');
    confirmActions.className = 'task-due-modal-actions';

    const confirmCancelBtn = document.createElement('button');
    confirmCancelBtn.type = 'button';
    confirmCancelBtn.className = 'link-btn task-due-cancel-btn';
    confirmCancelBtn.textContent = 'Cancel';
    confirmCancelBtn.addEventListener('click', () => confirmBackdrop.remove());

    const confirmDeleteBtn = createLoadableButton('task-form-delete-confirm-btn', 'Delete');
    confirmDeleteBtn.addEventListener('click', async () => {
      setBtnLoading(confirmDeleteBtn, true);
      confirmCancelBtn.disabled = true;
      try {
        await onDelete();
        confirmBackdrop.remove();
        closeTaskFormEditor();
      } catch (err) {
        setBtnLoading(confirmDeleteBtn, false);
        confirmCancelBtn.disabled = false;
        tasksStatusEl.hidden = false;
        tasksStatusEl.textContent = `Couldn't delete task: ${err.message}`;
      }
    });

    confirmActions.appendChild(confirmCancelBtn);
    confirmActions.appendChild(confirmDeleteBtn);
    confirmModal.appendChild(confirmActions);
    confirmBackdrop.appendChild(confirmModal);
    document.body.appendChild(confirmBackdrop);
  }

  backdrop.appendChild(editor);
  document.body.appendChild(backdrop);
  titleInput.focus();
}

function openEditTaskModal(task) {
  openTaskFormModal({
    heading: 'Edit task',
    initialTitle: task.title,
    initialProjectId: task.projectId,
    submitLabel: 'Save',
    onSubmit: async ({ title, projectId }) => {
      await window.focusbuddy.ticktick.updateTask(task.id, task.projectId, {
        title: title !== task.title ? title : undefined,
        projectId: projectId !== task.projectId ? projectId : undefined,
      });
      loadTasks();
    },
    onDelete: async () => {
      await window.focusbuddy.ticktick.deleteTask(task.projectId, task.id);
      if (task.id === selectedTaskId) selectedTaskId = null;
      loadTasks();
    },
  });
}

function closeTaskMenu() {
  const menu = document.querySelector('.task-menu-dropdown');
  if (menu) menu.remove();
}

document.addEventListener('click', closeTaskMenu);

function createTaskMenuButton(task) {
  const wrap = document.createElement('span');
  wrap.className = 'task-menu';

  const menuBtn = document.createElement('button');
  menuBtn.type = 'button';
  menuBtn.className = 'task-menu-btn';
  menuBtn.setAttribute('aria-label', 'Task options');
  menuBtn.textContent = '⋯';

  menuBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const alreadyOpen = wrap.querySelector('.task-menu-dropdown');
    closeTaskMenu();
    if (alreadyOpen) return;

    const dropdown = document.createElement('div');
    dropdown.className = 'task-menu-dropdown';
    dropdown.addEventListener('click', (evt) => evt.stopPropagation());

    const editItem = document.createElement('button');
    editItem.type = 'button';
    editItem.className = 'task-menu-item';
    editItem.textContent = 'Edit';
    editItem.addEventListener('click', () => {
      closeTaskMenu();
      openEditTaskModal(task);
    });

    const deleteItem = document.createElement('button');
    deleteItem.type = 'button';
    deleteItem.className = 'task-menu-item task-menu-item-danger';
    deleteItem.textContent = 'Delete';
    deleteItem.addEventListener('click', async () => {
      closeTaskMenu();
      try {
        await window.focusbuddy.ticktick.deleteTask(task.projectId, task.id);
        if (task.id === selectedTaskId) selectedTaskId = null;
        loadTasks();
      } catch (err) {
        tasksStatusEl.hidden = false;
        tasksStatusEl.textContent = `Couldn't delete task: ${err.message}`;
      }
    });

    dropdown.appendChild(editItem);
    dropdown.appendChild(deleteItem);
    wrap.appendChild(dropdown);
  });

  wrap.appendChild(menuBtn);
  return wrap;
}

function closeSubtaskDialog() {
  const backdrop = document.querySelector('.subtask-dialog-backdrop');
  if (backdrop) backdrop.remove();
  subtaskDialogTaskId = null;
}

function openSubtaskDialog(task) {
  document.querySelectorAll('.task-due-control.editing').forEach((el) => closeDueEditor(el));
  closeTaskFormEditor();
  closeSubtaskDialog();
  subtaskDialogTaskId = task.id;

  const backdrop = document.createElement('div');
  backdrop.className = 'task-due-modal-backdrop subtask-dialog-backdrop';
  backdrop.addEventListener('click', closeSubtaskDialog);

  const dialog = document.createElement('div');
  dialog.className = 'task-due-modal subtask-dialog';
  dialog.addEventListener('click', (evt) => evt.stopPropagation());

  const titleRow = document.createElement('div');
  titleRow.className = 'task-form-title-row';

  const title = document.createElement('div');
  title.className = 'task-due-modal-title';
  title.textContent = task.title;
  titleRow.appendChild(title);
  titleRow.appendChild(createTaskMenuButton(task));

  dialog.appendChild(titleRow);

  const subtaskList = document.createElement('ul');
  subtaskList.className = 'subtask-list subtask-dialog-list';
  for (const subtask of task.subtasks || []) {
    subtaskList.appendChild(createSubtaskItem(task, subtask));
  }

  const addSubtaskRow = document.createElement('li');
  addSubtaskRow.className = 'subtask-add-row';
  const addSubtaskBtn = document.createElement('button');
  addSubtaskBtn.type = 'button';
  addSubtaskBtn.className = 'link-btn subtask-add-btn';
  addSubtaskBtn.textContent = '+ Add subtask';
  addSubtaskBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    startAddSubtask(task, subtaskList, addSubtaskRow);
  });
  addSubtaskRow.appendChild(addSubtaskBtn);
  subtaskList.appendChild(addSubtaskRow);

  dialog.appendChild(subtaskList);

  const actions = document.createElement('div');
  actions.className = 'task-due-modal-actions';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'link-btn task-due-cancel-btn';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', closeSubtaskDialog);
  actions.appendChild(closeBtn);
  dialog.appendChild(actions);

  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);
}

function createSubtaskItem(task, subtask) {
  const subtaskItem = document.createElement('li');
  subtaskItem.className = 'subtask-item';
  if (subtask.completed) subtaskItem.classList.add('completed');
  if (subtask.id === selectedTaskId) subtaskItem.classList.add('selected');

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'subtask-complete-checkbox';
  checkbox.checked = subtask.completed;
  checkbox.addEventListener('click', (event) => event.stopPropagation());
  checkbox.addEventListener('change', async () => {
    checkbox.disabled = true;
    try {
      await window.focusbuddy.ticktick.completeTask(subtask.projectId, subtask.id);
      window.focusbuddySounds.celebrate();
      if (subtask.id === selectedTaskId) selectedTaskId = null;
      task.subtasks = task.subtasks.filter((s) => s.id !== subtask.id);
      renderTasks(currentTasks);
      syncOpenSubtaskDialog();
    } catch (err) {
      checkbox.checked = false;
      checkbox.disabled = false;
      tasksStatusEl.hidden = false;
      tasksStatusEl.textContent = `Couldn't mark "${subtask.title}" complete: ${err.message}`;
    }
  });
  subtaskItem.appendChild(checkbox);

  const subtaskTitle = document.createElement('span');
  subtaskTitle.className = 'subtask-title';
  subtaskTitle.textContent = subtask.title;
  subtaskItem.appendChild(subtaskTitle);

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'subtask-delete-btn';
  deleteBtn.textContent = '×';
  deleteBtn.title = 'Delete subtask';
  deleteBtn.addEventListener('click', async (event) => {
    event.stopPropagation();
    deleteBtn.disabled = true;
    try {
      await window.focusbuddy.ticktick.deleteSubtask(subtask.projectId, subtask.id);
      if (subtask.id === selectedTaskId) selectedTaskId = null;
      loadTasks();
    } catch (err) {
      deleteBtn.disabled = false;
      tasksStatusEl.hidden = false;
      tasksStatusEl.textContent = `Couldn't delete subtask: ${err.message}`;
    }
  });
  subtaskItem.appendChild(deleteBtn);

  subtaskItem.addEventListener('click', () => {
    window.focusbuddySounds.select();
    selectedTaskId = subtask.id === selectedTaskId ? null : subtask.id;
    subtaskItem.classList.toggle('selected', subtask.id === selectedTaskId);
    updateIdleTaskLabel();
  });

  subtaskItem.addEventListener('dblclick', (event) => {
    event.stopPropagation();
    startEditSubtask(subtask, subtaskItem, subtaskTitle);
  });

  return subtaskItem;
}

function startEditSubtask(subtask, subtaskItem, subtaskTitle) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'subtask-edit-input';
  input.value = subtask.title;
  subtaskItem.replaceChild(input, subtaskTitle);
  input.focus();
  input.select();

  let settled = false;
  const commit = async () => {
    if (settled) return;
    const value = input.value.trim();
    if (!value || value === subtask.title) {
      settled = true;
      subtaskItem.replaceChild(subtaskTitle, input);
      return;
    }
    settled = true;
    input.disabled = true;
    try {
      await window.focusbuddy.ticktick.updateTask(subtask.id, subtask.projectId, { title: value });
      loadTasks();
    } catch (err) {
      tasksStatusEl.hidden = false;
      tasksStatusEl.textContent = `Couldn't update subtask: ${err.message}`;
      subtaskItem.replaceChild(subtaskTitle, input);
    }
  };
  const cancel = () => {
    if (settled) return;
    settled = true;
    subtaskItem.replaceChild(subtaskTitle, input);
  };

  input.addEventListener('click', (event) => event.stopPropagation());
  input.addEventListener('dblclick', (event) => event.stopPropagation());
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') commit();
    if (event.key === 'Escape') cancel();
  });
  input.addEventListener('blur', commit);
}

function startAddSubtask(task, subtaskList, beforeEl) {
  const li = document.createElement('li');
  li.className = 'subtask-item subtask-item-new';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'subtask-edit-input';
  input.placeholder = 'Subtask title';
  li.appendChild(input);
  subtaskList.insertBefore(li, beforeEl);
  input.focus();

  let settled = false;
  const commit = async () => {
    if (settled) return;
    const value = input.value.trim();
    if (!value) {
      settled = true;
      li.remove();
      return;
    }
    settled = true;
    input.disabled = true;
    try {
      await window.focusbuddy.ticktick.addSubtask(task.projectId, task.id, value);
      loadTasks();
    } catch (err) {
      tasksStatusEl.hidden = false;
      tasksStatusEl.textContent = `Couldn't add subtask: ${err.message}`;
      li.remove();
    }
  };

  input.addEventListener('click', (event) => event.stopPropagation());
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') commit();
    if (event.key === 'Escape') {
      settled = true;
      li.remove();
    }
  });
  input.addEventListener('blur', commit);
}

function createTaskItem(task, bucket) {
  const item = document.createElement('li');
  item.className = 'task-item';
  item.dataset.taskId = task.id;
  if (task.id === selectedTaskId) item.classList.add('selected');

  const row = document.createElement('div');
  row.className = 'task-row';

  const complete = document.createElement('input');
  complete.type = 'checkbox';
  complete.className = 'task-complete-checkbox';
  complete.addEventListener('click', (event) => event.stopPropagation());
  complete.addEventListener('change', async () => {
    complete.disabled = true;
    try {
      await window.focusbuddy.ticktick.completeTask(task.projectId, task.id);
      window.focusbuddySounds.celebrate();
      if (task.id === selectedTaskId) selectedTaskId = null;
      renderTasks(currentTasks.filter((t) => t.id !== task.id));
    } catch (err) {
      complete.checked = false;
      complete.disabled = false;
      tasksStatusEl.hidden = false;
      tasksStatusEl.textContent = `Couldn't mark "${task.title}" complete: ${err.message}`;
    }
  });

  const title = document.createElement('span');
  title.className = 'task-title';
  title.textContent = task.title;
  if (task.subtasks && task.subtasks.length) {
    const count = document.createElement('span');
    count.className = 'task-subtask-count';
    count.textContent = ` (${task.subtasks.filter((s) => !s.completed).length}/${task.subtasks.length})`;
    title.appendChild(count);
  }
  title.addEventListener('click', (event) => {
    event.stopPropagation();
    openSubtaskDialog(task);
  });

  const project = document.createElement('span');
  project.className = 'task-project';
  project.textContent = task.projectName;

  const meta = document.createElement('div');
  meta.className = 'task-meta';
  meta.appendChild(project);

  if (bucket === 'overdue') {
    const todayBtn = document.createElement('button');
    todayBtn.type = 'button';
    todayBtn.className = 'link-btn task-today-btn';
    todayBtn.textContent = 'Today';
    todayBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      updateTaskDueDate(task, `${todayYMD()}T00:00:00.000+0000`, true);
    });
    meta.appendChild(todayBtn);
  } else {
    meta.appendChild(createDueControl(task, bucket));
  }

  row.appendChild(complete);
  row.appendChild(title);
  row.appendChild(meta);
  item.appendChild(row);

  row.addEventListener('click', () => {
    window.focusbuddySounds.select();
    selectedTaskId = task.id === selectedTaskId ? null : task.id;
    renderTasks(currentTasks);
    updateIdleTaskLabel();
  });

  return item;
}

function appendTaskSection(label, tasks, bucket, sectionAction) {
  if (!tasks.length) return;

  const heading = document.createElement('li');
  heading.className = 'task-section-title';
  const labelSpan = document.createElement('span');
  labelSpan.textContent = `${label} (${tasks.length})`;
  heading.appendChild(labelSpan);
  if (sectionAction) heading.appendChild(sectionAction);
  taskListEl.appendChild(heading);

  for (const task of tasks) {
    taskListEl.appendChild(createTaskItem(task, bucket));
  }
}

function appendUpcomingSection(tasks) {
  if (!tasks.length) return;

  const heading = document.createElement('li');
  heading.className = 'task-section-title';
  const labelSpan = document.createElement('span');
  labelSpan.textContent = `Upcoming (${tasks.length})`;
  heading.appendChild(labelSpan);
  taskListEl.appendChild(heading);

  let currentDayKey = null;
  for (const task of tasks) {
    const due = new Date(task.dueDate);
    const dayKey = due.toDateString();
    if (dayKey !== currentDayKey) {
      currentDayKey = dayKey;
      const daySubheading = document.createElement('li');
      daySubheading.className = 'task-day-subheading';
      daySubheading.textContent = due.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      taskListEl.appendChild(daySubheading);
    }
    taskListEl.appendChild(createTaskItem(task, 'upcoming'));
  }
}

function renderTasks(tasks) {
  currentTasks = tasks;
  taskListEl.innerHTML = '';
  updateOverdueState(tasks);

  if (!tasks.length) {
    tasksStatusEl.hidden = false;
    tasksStatusEl.textContent = 'No open tasks — nice work.';
    taskListEl.hidden = true;
    updateIdleTaskLabel();
    return;
  }

  tasksStatusEl.hidden = true;
  taskListEl.hidden = false;

  const { overdue, today, upcoming, noDueDate } = bucketTasksByDate(tasks);

  let moveAllBtn = null;
  if (overdue.length) {
    moveAllBtn = document.createElement('button');
    moveAllBtn.type = 'button';
    moveAllBtn.className = 'link-btn task-move-all-today-btn';
    moveAllBtn.textContent = 'Move all to Today';
    moveAllBtn.addEventListener('click', async (event) => {
      event.stopPropagation();
      moveAllBtn.disabled = true;
      const todayDate = `${todayYMD()}T00:00:00.000+0000`;
      // Sequential so a mid-batch failure doesn't leave a hard-to-reason-about
      // half-applied state and error messages don't race each other.
      for (const task of [...overdue]) {
        await updateTaskDueDate(task, todayDate, true);
      }
    });
  }

  appendTaskSection('Overdue', overdue, 'overdue', moveAllBtn);
  appendTaskSection('Today', today, 'today');
  appendUpcomingSection(upcoming);
  appendTaskSection('No due date', noDueDate, 'noDueDate');
  updateIdleTaskLabel();
}

async function loadTasks() {
  tasksStatusEl.hidden = false;
  tasksStatusEl.textContent = 'Loading tasks…';
  taskListEl.hidden = true;

  try {
    const tasks = await window.focusbuddy.ticktick.getTasks();
    renderTasks(tasks);
    syncOpenSubtaskDialog();
  } catch (err) {
    tasksStatusEl.textContent = `Couldn't load tasks: ${err.message}`;
  }
}

function syncOpenSubtaskDialog() {
  if (!subtaskDialogTaskId || !document.querySelector('.subtask-dialog-backdrop')) return;
  const task = currentTasks.find((t) => t.id === subtaskDialogTaskId);
  if (task) openSubtaskDialog(task);
  else closeSubtaskDialog();
}

async function refreshConnectionState() {
  const connected = await window.focusbuddy.ticktick.isAuthenticated();
  renderConnected(connected);
  if (connected) await loadTasks();
}

connectBtn.addEventListener('click', async () => {
  connectBtn.disabled = true;
  ticktickStatusEl.textContent = 'Opening browser to connect…';
  try {
    await window.focusbuddy.ticktick.connect();
    await refreshConnectionState();
  } catch (err) {
    ticktickStatusEl.textContent = `Connection failed: ${err.message}`;
  } finally {
    connectBtn.disabled = false;
  }
});

logoutBtn.addEventListener('click', async () => {
  await window.focusbuddy.ticktick.logout();
  cachedProjects = null;
  await refreshConnectionState();
});

refreshTasksBtn.addEventListener('click', loadTasks);

addTaskBtn.addEventListener('click', async () => {
  const originalLabel = addTaskBtn.textContent;
  addTaskBtn.disabled = true;
  addTaskBtn.textContent = 'Loading…';
  try {
    await openTaskFormModal({
      heading: 'Add task',
      initialTitle: '',
      initialProjectId: 'inbox',
      submitLabel: 'Add',
      onSubmit: async ({ title, projectId, due }) => {
        await window.focusbuddy.ticktick.createTask(title, projectId, due);
        loadTasks();
      },
    });
  } finally {
    addTaskBtn.disabled = false;
    addTaskBtn.textContent = originalLabel;
  }
});

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const panelAvatar = document.getElementById('panel-avatar');

function moodFor(state) {
  if (state.status === 'running') return 'focused';
  if (state.status === 'paused') return 'paused';
  if (state.status === 'completed') return 'celebrating';
  return 'idle';
}

function renderTimerState(state) {
  currentTimerState = state;
  const displaySeconds = state.status === 'idle'
    ? Number(timerMinutesInput.value || 0) * 60
    : state.remainingSeconds;
  timerDisplayEl.textContent = formatTime(displaySeconds);
  if (state.status === 'idle') updateIdleTaskLabel();
  else timerTaskEl.textContent = state.task ? state.task.title : 'No task selected';
  panelAvatar.dataset.mood = moodFor(state);

  const running = state.status === 'running';
  const paused = state.status === 'paused';

  timerStartBtn.hidden = running || paused;
  timerPauseBtn.hidden = !running;
  timerResumeBtn.hidden = !paused;
  timerResetBtn.hidden = state.status === 'idle';
  timerMinutesInput.disabled = running || paused;
  markCompleteCheckbox.disabled = running || paused;
  blockSitesCheckbox.disabled = running || paused;
}

function renderBlockingState(active) {
  blockingStatusEl.textContent = active ? 'Distracting sites are blocked.' : 'Sites not blocked.';
  unblockNowBtn.hidden = !active;
}

async function initBlocking() {
  const domains = await window.focusbuddy.blocking.getDomains();
  blockingDomainsHintEl.textContent = `Blocks: ${domains.join(', ')}`;
  blockSitesCheckbox.checked = await window.focusbuddy.blocking.getEnabledDefault();
  renderBlockingState(await window.focusbuddy.blocking.isActive());
  window.focusbuddy.blocking.onState(renderBlockingState);
}

unblockNowBtn.addEventListener('click', async () => {
  renderBlockingState(await window.focusbuddy.blocking.unblockNow());
});

timerMinutesInput.addEventListener('input', () => {
  if (timerMinutesInput.disabled) return;
  timerDisplayEl.textContent = formatTime(Number(timerMinutesInput.value || 0) * 60);
});

async function initTimer() {
  const defaultMinutes = await window.focusbuddy.timer.getDefaultMinutes();
  timerMinutesInput.value = defaultMinutes;
  markCompleteCheckbox.checked = await window.focusbuddy.timer.getMarkCompleteDefault();

  const state = await window.focusbuddy.timer.getState();
  renderTimerState(state);
  window.focusbuddy.timer.onState(renderTimerState);
  window.focusbuddy.timer.onSessionCompleted(renderSessionCompleted);
}

function renderSessionCompleted({ entry, ticktickSynced, ticktickError, focusSynced, focusError }) {
  window.focusbuddySounds.celebrate();
  sessionStatusEl.hidden = false;

  const parts = ['Session logged.'];
  if (entry.task) {
    if (ticktickSynced) parts.push(`"${entry.task.title}" marked complete in TickTick.`);
    else if (ticktickError) parts.push(`Couldn't mark task complete: ${ticktickError}`);
  }
  if (focusSynced) parts.push('Focus session saved to TickTick.');
  else if (focusError) parts.push(`Couldn't save focus session to TickTick: ${focusError}`);

  sessionStatusEl.textContent = parts.join(' ');
}

timerStartBtn.addEventListener('click', async () => {
  window.focusbuddySounds.start();
  const minutes = Number(timerMinutesInput.value) || 25;
  const task = findSelectedTask();
  sessionStatusEl.hidden = true;
  timerStartBtn.disabled = true;
  try {
    renderTimerState(
      await window.focusbuddy.timer.start(minutes, task, markCompleteCheckbox.checked, blockSitesCheckbox.checked)
    );
  } catch (err) {
    sessionStatusEl.hidden = false;
    sessionStatusEl.textContent = `Couldn't start session: ${err.message}`;
  } finally {
    timerStartBtn.disabled = false;
  }
});

timerPauseBtn.addEventListener('click', async () => {
  window.focusbuddySounds.click();
  renderTimerState(await window.focusbuddy.timer.pause());
});

timerResumeBtn.addEventListener('click', async () => {
  window.focusbuddySounds.click();
  renderTimerState(await window.focusbuddy.timer.resume());
});

timerResetBtn.addEventListener('click', async () => {
  window.focusbuddySounds.click();
  sessionStatusEl.hidden = true;
  renderTimerState(await window.focusbuddy.timer.reset());
});

let settingsSavedTimeout = null;
function flashSettingsSaved() {
  settingsSavedHintEl.hidden = false;
  clearTimeout(settingsSavedTimeout);
  settingsSavedTimeout = setTimeout(() => {
    settingsSavedHintEl.hidden = true;
  }, 1500);
}

async function initSettings() {
  const settings = await window.focusbuddy.settings.get();
  defaultMinutesInput.value = settings.defaultMinutes;
  defaultMarkCompleteCheckbox.checked = settings.markTaskCompleteByDefault;
  defaultBlockSitesCheckbox.checked = settings.blockSitesByDefault;
}

// Only overwrite the live start-session controls while idle, so changing
// defaults never clobbers a running/paused session's chosen values.
function applySettingsToLiveTimer(settings) {
  if (currentTimerState && currentTimerState.status !== 'idle') return;
  if (settings.defaultMinutes !== undefined) {
    timerMinutesInput.value = settings.defaultMinutes;
    timerDisplayEl.textContent = formatTime(Number(timerMinutesInput.value || 0) * 60);
  }
  if (settings.markTaskCompleteByDefault !== undefined) {
    markCompleteCheckbox.checked = settings.markTaskCompleteByDefault;
  }
  if (settings.blockSitesByDefault !== undefined) {
    blockSitesCheckbox.checked = settings.blockSitesByDefault;
  }
}

defaultMinutesInput.addEventListener('change', async () => {
  const settings = await window.focusbuddy.settings.update({ defaultMinutes: defaultMinutesInput.value });
  defaultMinutesInput.value = settings.defaultMinutes;
  applySettingsToLiveTimer({ defaultMinutes: settings.defaultMinutes });
  flashSettingsSaved();
});

defaultMarkCompleteCheckbox.addEventListener('change', async () => {
  await window.focusbuddy.settings.update({ markTaskCompleteByDefault: defaultMarkCompleteCheckbox.checked });
  applySettingsToLiveTimer({ markTaskCompleteByDefault: defaultMarkCompleteCheckbox.checked });
  flashSettingsSaved();
});

defaultBlockSitesCheckbox.addEventListener('change', async () => {
  await window.focusbuddy.settings.update({ blockSitesByDefault: defaultBlockSitesCheckbox.checked });
  applySettingsToLiveTimer({ blockSitesByDefault: defaultBlockSitesCheckbox.checked });
  flashSettingsSaved();
});

settingsToggleBtn.addEventListener('click', () => {
  const open = settingsSection.hidden;
  settingsSection.hidden = !open;
  settingsToggleBtn.setAttribute('aria-pressed', String(open));
});

document.getElementById('panel-close-btn').addEventListener('click', () => window.focusbuddy.panel.hide());
window.focusbuddy.panel.onWillShow((anchorSide) => {
  document.body.dataset.anchor = anchorSide === 'right' ? 'left' : 'right';
  document.body.classList.remove('panel-visible');
  void document.body.offsetWidth;
  document.body.classList.add('panel-visible');
});

refreshConnectionState();
initTimer();
initBlocking();
initSettings();
