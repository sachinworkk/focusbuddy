const config = require('../../config');
const { loadTokens } = require('./token-store');
const subtaskLinks = require('./subtask-links');

async function authedFetch(path, options = {}) {
  const tokens = loadTokens();
  if (!tokens?.access_token) {
    throw new Error('Not authenticated with TickTick');
  }

  const response = await fetch(`${config.ticktick.apiBase}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${tokens.access_token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`TickTick API error: ${response.status} ${await response.text()}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function getProjects() {
  return authedFetch('/project');
}

function getProjectData(projectId) {
  return authedFetch(`/project/${projectId}/data`);
}

const INBOX_PROJECT = { id: 'inbox', name: 'Inbox' };

// TickTick's Open API has no single "all tasks" endpoint, so we fan out
// across projects and flatten the results. GET /project never lists the
// Inbox, but "inbox" is a documented special-case projectId for
// /project/{projectId}/data, so it's fetched separately and merged in.
async function getAllTasks() {
  const projects = await getProjects();
  const perProject = await Promise.all(
    [INBOX_PROJECT, ...projects].map((project) =>
      getProjectData(project.id).then((data) => ({ project, tasks: data.tasks || [] }))
    )
  );

  const links = subtaskLinks.getLinks();

  return perProject.flatMap(({ project, tasks }) => {
    // Subtasks are ordinary tasks linked via `parentId`/`childIds`, shown
    // nested under their parent in TickTick's own UI (e.g. "HOML : CNN
    // chapter" under "Daily Learning Block"). TickTick's own `parentId` is
    // trusted first; the local link file (see subtask-links.js) is a
    // fallback for when we created the link ourselves and TickTick's Open
    // API silently didn't persist it. A link is only honored if its parent
    // id resolves to a task actually present in this fetch, so a stale
    // link (parent deleted) doesn't make the child vanish — it just falls
    // back to showing up as a normal top-level task.
    const byId = new Map(tasks.map((task) => [task.id, task]));
    const parentIdOf = (task) => {
      if (task.parentId && byId.has(task.parentId)) return task.parentId;
      const linked = links[task.id];
      return linked && byId.has(linked) ? linked : null;
    };
    const isChild = (task) => parentIdOf(task) != null;

    return tasks
      .filter((task) => !isChild(task))
      .map((task) => ({
        id: task.id,
        projectId: project.id,
        projectName: project.name,
        title: task.title,
        dueDate: task.dueDate || null,
        startDate: task.startDate || null,
        isAllDay: task.isAllDay || false,
        priority: task.priority,
        subtasks: tasks
          .filter((t) => parentIdOf(t) === task.id)
          .map((child) => ({
            id: child.id,
            projectId: project.id,
            title: child.title,
            completed: child.status === 2,
          })),
      }));
  });
}

function completeTask(projectId, taskId) {
  return authedFetch(`/project/${projectId}/task/${taskId}/complete`, { method: 'POST' });
}

// The INBOX_PROJECT.id sentinel ('inbox') is only valid as a projectId for
// GET /project/{projectId}/data. Write endpoints need TickTick's real inbox
// project id (form "inbox<numericUserId>"), which we read off any task
// returned from the inbox data endpoint.
let cachedInboxProjectId = null;

async function getInboxProjectId() {
  if (cachedInboxProjectId) return cachedInboxProjectId;
  const data = await getProjectData(INBOX_PROJECT.id);
  const realId = data?.tasks?.[0]?.projectId;
  if (!realId) {
    throw new Error('Could not resolve TickTick inbox project id (inbox is empty)');
  }
  cachedInboxProjectId = realId;
  return cachedInboxProjectId;
}

function resolveProjectId(projectId) {
  return projectId === INBOX_PROJECT.id ? getInboxProjectId() : Promise.resolve(projectId);
}

async function createTask({ title, projectId, dueDate, isAllDay, startDate }) {
  const resolvedProjectId = await resolveProjectId(projectId);
  const body = { title, projectId: resolvedProjectId };
  if (dueDate !== undefined) body.dueDate = dueDate;
  if (isAllDay !== undefined) body.isAllDay = isAllDay;
  if (startDate !== undefined) body.startDate = startDate;
  return authedFetch('/task', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function updateTask(taskId, currentProjectId, { title, projectId } = {}) {
  const resolvedCurrentProjectId = await resolveProjectId(currentProjectId);

  if (title !== undefined) {
    await authedFetch(`/task/${taskId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, projectId: resolvedCurrentProjectId, title }),
    });
  }

  if (projectId !== undefined && projectId !== currentProjectId) {
    const resolvedNewProjectId = await resolveProjectId(projectId);
    await authedFetch('/task/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { fromProjectId: resolvedCurrentProjectId, toProjectId: resolvedNewProjectId, taskId },
      ]),
    });
  }
}

async function deleteTask(projectId, taskId) {
  const resolvedProjectId = await resolveProjectId(projectId);
  return authedFetch(`/project/${resolvedProjectId}/task/${taskId}`, { method: 'DELETE' });
}

// Subtasks are just ordinary tasks. We attempt to set `parentId` on create
// so TickTick's own apps nest it too if the (undocumented) field is
// actually honored; the local link file is the source of truth regardless
// (see getAllTasks / subtask-links.js). Editing a subtask's title and
// completing it reuse updateTask/completeTask below unchanged.
async function createSubtask(projectId, parentTaskId, title) {
  const resolvedProjectId = await resolveProjectId(projectId);
  const created = await authedFetch('/task', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, projectId: resolvedProjectId, parentId: parentTaskId }),
  });
  subtaskLinks.linkSubtask(created.id, parentTaskId);
  return created;
}

async function deleteSubtask(projectId, subtaskId) {
  await deleteTask(projectId, subtaskId);
  subtaskLinks.unlinkSubtask(subtaskId);
}

function updateTaskDueDate(projectId, taskId, dueDate, isAllDay, startDate = dueDate) {
  return authedFetch(`/task/${taskId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: taskId,
      projectId,
      startDate,
      dueDate,
      isAllDay,
    }),
  });
}

function createFocusRecord({ taskId, startTime, endTime, durationSeconds }) {
  return authedFetch('/focus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 0, // Pomodoro
      taskId: taskId || undefined,
      startTime,
      endTime,
      duration: durationSeconds,
    }),
  });
}

module.exports = {
  getProjects,
  getProjectData,
  getAllTasks,
  completeTask,
  updateTaskDueDate,
  createFocusRecord,
  createTask,
  updateTask,
  deleteTask,
  createSubtask,
  deleteSubtask,
};
