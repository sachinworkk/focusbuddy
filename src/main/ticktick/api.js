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

  return response.json();
}

function getProjects() {
  return authedFetch('/project');
}

function getProjectData(projectId) {
  return authedFetch(`/project/${projectId}/data`);
}

// TickTick's Open API has no single "all tasks" endpoint, so we fan out
// across projects and flatten the results.
async function getAllTasks() {
  const projects = await getProjects();
  const perProject = await Promise.all(
    projects.map((project) =>
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

module.exports = { getProjects, getProjectData, getAllTasks };
