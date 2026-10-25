(function () {
  const STORAGE_KEY = 'bedtime-task-app-state';
  const DEFAULT_TASK_NAMES = [
    '夕食',
    '食器洗い・片付け',
    'お風呂',
    'スキンケア・歯磨き',
    '明日の服・荷物の準備',
    '部屋の簡単な片付け',
    '自由時間',
    '就寝準備'
  ];

  function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function createTaskId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }

  function normalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => {
      const replacements = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return replacements[character] || character;
    });
  }

  function sanitizeTaskName(value) {
    return escapeHtml(normalizeText(value));
  }

  function normalizeBedtime(value) {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmed)) {
      return null;
    }

    return trimmed;
  }

  function createDefaultTasks() {
    return DEFAULT_TASK_NAMES.map((name) => ({
      id: createTaskId(),
      name,
      completed: false
    }));
  }

  function buildDefaultState() {
    return {
      bedtime: '23:30',
      lastDateKey: formatDateKey(new Date()),
      tasks: createDefaultTasks()
    };
  }

  function readStorage() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn('Could not read localStorage:', error);
      return null;
    }
  }

  function writeStorage(data) {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Could not write localStorage:', error);
    }
  }

  function sanitizeState(rawState) {
    const fallback = buildDefaultState();
    if (!rawState || typeof rawState !== 'object') {
      return fallback;
    }

    const bedtime = normalizeBedtime(rawState.bedtime) || fallback.bedtime;
    const tasksSource = Array.isArray(rawState.tasks) ? rawState.tasks : fallback.tasks;
    const tasks = tasksSource
      .map((task) => {
        const name = sanitizeTaskName(task && task.name);
        if (!name) {
          return null;
        }

        return {
          id: typeof task?.id === 'string' && task.id ? task.id : createTaskId(),
          name,
          completed: Boolean(task && task.completed)
        };
      })
      .filter(Boolean);

    const lastDateKey = typeof rawState.lastDateKey === 'string' && rawState.lastDateKey
      ? rawState.lastDateKey
      : fallback.lastDateKey;

    return {
      bedtime,
      tasks,
      lastDateKey
    };
  }

  function reorderTasks(tasks, fromTaskId, toTaskId) {
    if (!Array.isArray(tasks) || !fromTaskId || !toTaskId || fromTaskId === toTaskId) {
      return tasks;
    }

    const nextTasks = [...tasks];
    const fromIndex = nextTasks.findIndex((task) => task.id === fromTaskId);
    const toIndex = nextTasks.findIndex((task) => task.id === toTaskId);

    if (fromIndex < 0 || toIndex < 0) {
      return tasks;
    }

    const [movedTask] = nextTasks.splice(fromIndex, 1);
    nextTasks.splice(toIndex, 0, movedTask);
    return nextTasks;
  }

  function saveState(state) {
    const nextState = {
      bedtime: normalizeBedtime(state.bedtime) || '23:30',
      lastDateKey: typeof state.lastDateKey === 'string' && state.lastDateKey ? state.lastDateKey : formatDateKey(new Date()),
      tasks: Array.isArray(state.tasks)
        ? state.tasks
            .map((task) => ({
              id: typeof task?.id === 'string' && task.id ? task.id : createTaskId(),
              name: sanitizeTaskName(task && task.name),
              completed: Boolean(task && task.completed)
            }))
            .filter((task) => task.name.length > 0)
        : []
    };

    writeStorage(nextState);
    return nextState;
  }

  function loadState() {
    const raw = readStorage();
    if (raw === null) {
      const initialState = buildDefaultState();
      writeStorage(initialState);
      return initialState;
    }

    return sanitizeState(raw);
  }

  function syncDateState(state) {
    const todayKey = formatDateKey(new Date());
    if (state.lastDateKey !== todayKey) {
      state.tasks = state.tasks.map((task) => ({
        ...task,
        completed: false
      }));
      state.lastDateKey = todayKey;
      return true;
    }

    return false;
  }

  function getCountdownParts(bedtimeValue) {
    const [hours, minutes] = bedtimeValue.split(':').map(Number);
    const now = new Date();
    const target = new Date(now);
    target.setHours(hours, minutes, 0, 0);

    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    const diffMinutes = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 60000));
    const hoursLeft = Math.floor(diffMinutes / 60);
    const minutesLeft = diffMinutes % 60;

    return { hoursLeft, minutesLeft };
  }

  function setMessage(messageElement, text) {
    if (!messageElement) {
      return;
    }

    messageElement.textContent = text;
  }

  function renderTaskProgress(progressElement, tasks) {
    if (!progressElement) {
      return;
    }

    const completedCount = tasks.filter((task) => task.completed).length;
    progressElement.textContent = `${completedCount} / ${tasks.length} 完了`;
  }

  function renderCountdown(countdownElement, bedtimeValue) {
    if (!countdownElement) {
      return;
    }

    const { hoursLeft, minutesLeft } = getCountdownParts(bedtimeValue);
    countdownElement.textContent = `あと ${hoursLeft}時間 ${minutesLeft}分`;
  }

  function renderTaskList(taskListElement, tasks) {
    if (!taskListElement) {
      return;
    }

    taskListElement.innerHTML = '';

    if (tasks.length === 0) {
      const emptyState = document.createElement('li');
      emptyState.className = 'empty-state';
      emptyState.textContent = 'タスクはまだありません';
      taskListElement.appendChild(emptyState);
      return;
    }

    tasks.forEach((task) => {
      const item = document.createElement('li');
      item.className = `task-item${task.completed ? ' is-complete' : ''}`;
      item.dataset.taskId = task.id;
      item.draggable = true;

      const main = document.createElement('label');
      main.className = 'task-main';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'task-checkbox';
      checkbox.checked = task.completed;
      checkbox.dataset.taskId = task.id;

      const name = document.createElement('span');
      name.className = 'task-name';
      name.textContent = task.name;

      main.appendChild(checkbox);
      main.appendChild(name);

      const actions = document.createElement('div');
      actions.className = 'task-actions';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'task-action-button edit-task';
      editButton.dataset.taskId = task.id;
      editButton.textContent = '編集';

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'task-action-button delete-task';
      deleteButton.dataset.taskId = task.id;
      deleteButton.textContent = '削除';

      actions.appendChild(editButton);
      actions.appendChild(deleteButton);
      item.appendChild(main);
      item.appendChild(actions);
      taskListElement.appendChild(item);
    });
  }

  function renderApp(state, elements) {
    const {
      bedtimeElement,
      countdownElement,
      taskListElement,
      progressElement,
      bedtimeInput,
      messageElement
    } = elements;

    if (bedtimeElement) {
      bedtimeElement.textContent = state.bedtime;
    }

    if (bedtimeInput) {
      bedtimeInput.value = state.bedtime;
    }

    if (countdownElement) {
      renderCountdown(countdownElement, state.bedtime);
    }

    if (taskListElement) {
      renderTaskList(taskListElement, state.tasks);
    }

    if (progressElement) {
      renderTaskProgress(progressElement, state.tasks);
    }

  }

  function setupApp() {
    const bedtimeElement = document.getElementById('bedtime');
    const countdownElement = document.getElementById('countdown');
    const settingsButton = document.getElementById('settings-button');
    const settingsDialog = document.getElementById('settings-dialog');
    const settingsForm = document.getElementById('settings-form');
    const bedtimeInput = document.getElementById('bedtime-input');
    const cancelSettings = document.getElementById('cancel-settings');
    const taskListElement = document.getElementById('task-list');
    const progressElement = document.getElementById('task-progress');
    const addTaskForm = document.getElementById('add-task-form');
    const newTaskInput = document.getElementById('new-task');
    const messageElement = document.getElementById('message');

    if (!bedtimeElement || !countdownElement || !taskListElement || !progressElement || !addTaskForm || !newTaskInput || !settingsButton || !settingsForm || !bedtimeInput || !messageElement) {
      return;
    }

    const elements = {
      bedtimeElement,
      countdownElement,
      taskListElement,
      progressElement,
      bedtimeInput,
      messageElement
    };

    let state = loadState();
    const didReset = syncDateState(state);
    if (didReset) {
      state = saveState(state);
    }
    renderApp(state, elements);
    let draggedTaskId = null;

    function persistAndRender() {
      state = saveState(state);
      renderApp(state, elements);
    }

    function handleOpenSettings() {
      if (settingsDialog && typeof settingsDialog.showModal === 'function') {
        bedtimeInput.value = state.bedtime;
        settingsDialog.showModal();
      }
    }

    function handleCloseSettings() {
      if (settingsDialog && typeof settingsDialog.close === 'function') {
        settingsDialog.close();
      }
    }

    settingsButton.addEventListener('click', handleOpenSettings);
    cancelSettings?.addEventListener('click', handleCloseSettings);

    settingsDialog?.addEventListener('click', (event) => {
      if (event.target === settingsDialog) {
        handleCloseSettings();
      }
    });

    settingsForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const nextBedtime = normalizeBedtime(bedtimeInput.value);
      if (!nextBedtime) {
        setMessage(messageElement, '時刻を正しく入力してください。');
        return;
      }

      state.bedtime = nextBedtime;
      persistAndRender();
      handleCloseSettings();
    });

    addTaskForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const taskName = sanitizeTaskName(newTaskInput.value);
      if (!taskName) {
        setMessage(messageElement, 'タスク名を入力してください。');
        newTaskInput.focus();
        return;
      }

      state.tasks.push({
        id: createTaskId(),
        name: taskName,
        completed: false
      });
      newTaskInput.value = '';
      persistAndRender();
      setMessage(messageElement, 'タスクを追加しました。');
    });

    taskListElement.addEventListener('dragstart', (event) => {
      const item = event.target.closest('.task-item');
      if (!item) {
        return;
      }

      draggedTaskId = item.dataset.taskId;
      item.classList.add('dragging');

      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', draggedTaskId);
      }
    });

    taskListElement.addEventListener('dragover', (event) => {
      const item = event.target.closest('.task-item');
      if (!item || !draggedTaskId) {
        return;
      }

      event.preventDefault();
      taskListElement.querySelectorAll('.task-item').forEach((taskItem) => {
        taskItem.classList.toggle('drag-over', taskItem === item && taskItem.dataset.taskId !== draggedTaskId);
      });
    });

    taskListElement.addEventListener('drop', (event) => {
      const item = event.target.closest('.task-item');
      if (!item || !draggedTaskId) {
        return;
      }

      event.preventDefault();
      const targetTaskId = item.dataset.taskId;
      if (targetTaskId && targetTaskId !== draggedTaskId) {
        state.tasks = reorderTasks(state.tasks, draggedTaskId, targetTaskId);
        persistAndRender();
        setMessage(messageElement, 'タスクの順番を変更しました。');
      }

      draggedTaskId = null;
      taskListElement.querySelectorAll('.task-item').forEach((taskItem) => {
        taskItem.classList.remove('dragging', 'drag-over');
      });
    });

    taskListElement.addEventListener('dragend', () => {
      draggedTaskId = null;
      taskListElement.querySelectorAll('.task-item').forEach((taskItem) => {
        taskItem.classList.remove('dragging', 'drag-over');
      });
    });

    taskListElement.addEventListener('change', (event) => {
      const checkbox = event.target;
      if (!(checkbox instanceof HTMLElement) || !checkbox.matches('.task-checkbox')) {
        return;
      }

      const taskId = checkbox.dataset.taskId;
      const targetTask = state.tasks.find((task) => task.id === taskId);
      if (!targetTask) {
        return;
      }

      targetTask.completed = checkbox.checked;
      persistAndRender();
    });

    taskListElement.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) {
        return;
      }

      const taskId = button.dataset.taskId;
      const targetTask = state.tasks.find((task) => task.id === taskId);
      if (!targetTask) {
        return;
      }

      if (button.classList.contains('delete-task')) {
        state.tasks = state.tasks.filter((task) => task.id !== taskId);
        persistAndRender();
        setMessage(messageElement, 'タスクを削除しました。');
        return;
      }

      if (button.classList.contains('edit-task')) {
        const nextName = window.prompt('タスク名を編集してください', targetTask.name);
        if (nextName === null) {
          return;
        }

        const trimmedName = sanitizeTaskName(nextName);
        if (!trimmedName) {
          setMessage(messageElement, '空白だけのタスク名は登録できません。');
          return;
        }

        targetTask.name = trimmedName;
        persistAndRender();
        setMessage(messageElement, 'タスク名を更新しました。');
      }
    });

    setInterval(() => {
      const changed = syncDateState(state);
      if (changed) {
        state = saveState(state);
        renderApp(state, elements);
        setMessage(messageElement, '日付が変わったので、完了状態をリセットしました。');
      } else {
        renderCountdown(countdownElement, state.bedtime);
      }
    }, 1000);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupApp);
    } else {
      setupApp();
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      formatDateKey,
      normalizeBedtime,
      getCountdownParts,
      normalizeText,
      sanitizeState,
      buildDefaultState
    };
  }
})();
