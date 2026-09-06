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
      priority: task.priority,
    }))
  );
}

function completeTask(projectId, taskId) {
  return authedFetch(`/project/${projectId}/task/${taskId}/complete`, { method: 'POST' });
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

module.exports = { getProjects, getProjectData, getAllTasks, completeTask, createFocusRecord };
