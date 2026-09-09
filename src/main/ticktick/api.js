const config = require('../../config');
const { loadTokens } = require('./token-store');

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

  return perProject.flatMap(({ project, tasks }) =>
    tasks.map((task) => ({
      id: task.id,
      projectId: project.id,
      projectName: project.name,
      title: task.title,
      dueDate: task.dueDate || null,
      isAllDay: task.isAllDay || false,
      priority: task.priority,
    }))
  );
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

async function createTask({ title, projectId }) {
  const resolvedProjectId = await resolveProjectId(projectId);
  return authedFetch('/task', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, projectId: resolvedProjectId }),
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
};
