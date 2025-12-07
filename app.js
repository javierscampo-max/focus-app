// State
let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
// Events format: "YYYY-MM-DD": [{ title: "Lunch", start: "12:00", end: "13:00" }]
let events = JSON.parse(localStorage.getItem('events')) || {};
let focusTime = 25 * 60;
let initialFocusTime = 25 * 60;
let isFocusing = false;
let focusInterval;

// DOM Elements
const views = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('.nav-item');
const taskList = document.getElementById('task-list');
const calendarGrid = document.getElementById('calendar-grid');
const timerDisplay = document.getElementById('timer-display');
const progressRing = document.querySelector('.progress-ring');
const durationSlider = document.getElementById('duration-slider');
const durationValue = document.getElementById('duration-value');

// Navigation
navItems.forEach(item => {
    item.addEventListener('click', () => {
        const targetId = item.dataset.target;
        views.forEach(v => v.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        if (targetId === 'view-calendar') renderCalendar();
    });
});

// Container Drop Zone Logic
const taskHeader = document.querySelector('.task-header');

[taskHeader, taskList].forEach(container => {
    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        // Visuals removed
    });

    container.addEventListener('dragleave', (e) => {
        if (e.target === container) {
            // Visuals removed
        }
    });

    container.addEventListener('drop', (e) => {
        e.preventDefault();
        stopAutoScroll();
        container.classList.remove(container === taskHeader ? 'drag-over-header' : 'drag-over-container');

        // Header Drop -> Top of List
        if (container === taskHeader || e.target.closest('.task-header')) {
            if (dragType === 'main') {
                const item = tasks.splice(dragStartIndex, 1)[0];
                tasks.unshift(item); // Move to Top
                saveTasks();
                renderTasks();
            } else if (dragType === 'sub') {
                convertSubtaskToMain(dragStartIndex, dragSubIndex, 0); // Un-nest to Top
            }
            return;
        }

        // List Drop -> Bottom of List
        if (e.target === taskList || e.target.classList.contains('empty-state')) {
            if (dragType === 'main') {
                const item = tasks.splice(dragStartIndex, 1)[0];
                tasks.push(item); // Move to Bottom
                saveTasks();
                renderTasks();
            } else if (dragType === 'sub') {
                convertSubtaskToMain(dragStartIndex, dragSubIndex, tasks.length); // Un-nest to Bottom
            }
        }
    });
});

// Global Drag End to guarantee cleanup (fixes stuck scroll)
document.addEventListener('dragend', () => {
    stopAutoScroll();
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    document.querySelectorAll('.nest-target').forEach(el => el.classList.remove('nest-target'));
    if (taskList) taskList.classList.remove('drag-over-container');
    const taskHeader = document.querySelector('.task-header');
    if (taskHeader) taskHeader.classList.remove('drag-over-header');
});

// --- TASKS ---
let dragStartIndex;
let dragSubIndex;
let dragType = 'main'; // 'main' or 'sub'

function renderTasks() {
    taskList.innerHTML = '';

    // Update Counter
    const remaining = tasks.filter(t => !t.completed).length;
    document.getElementById('task-count').textContent = `${remaining} left`;

    if (tasks.length === 0) {
        taskList.innerHTML = '<div class="empty-state"><p>No tasks yet. Tap + to add one.</p></div>';
        return;
    }

    tasks.forEach((task, index) => {
        // Ensure subtasks array exists
        if (!task.subtasks) task.subtasks = [];

        const li = document.createElement('div');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        li.id = `task-item-${index}`;
        li.draggable = true;
        li.dataset.index = index;

        // Drag Events
        li.addEventListener('dragstart', dragStart);
        li.addEventListener('dragover', dragOver);
        li.addEventListener('drop', dragDrop);
        li.addEventListener('dragenter', dragEnter);
        li.addEventListener('dragleave', dragLeave);

        let subtasksHtml = '';
        const hasSubtasks = task.subtasks.length > 0;
        const isCollapsed = task.collapsed || false;

        if (hasSubtasks) {
            subtasksHtml = `<div class="subtask-list ${isCollapsed ? 'collapsed' : ''}">`;
            task.subtasks.forEach((sub, subIndex) => {
                subtasksHtml += `
                    <div class="subtask-item ${sub.completed ? 'completed' : ''}" 
                         draggable="true" 
                         data-parent-index="${index}" 
                         data-sub-index="${subIndex}">
                        <div class="task-checkbox small" onclick="toggleSubtask(${index}, ${subIndex})">
                            ${sub.completed ? '✓' : ''}
                        </div>
                        <span class="task-text">${sub.text}</span>
                        <button class="delete-btn small" onclick="deleteSubtask(${index}, ${subIndex})">×</button>
                    </div>
                `;
            });
            subtasksHtml += '</div>';
        }

        const chevron = hasSubtasks
            ? `<button class="collapse-btn ${isCollapsed ? '' : 'open'}" onclick="toggleCollapse(${index}, event)">›</button>`
            : '';

        li.innerHTML = `
            <div class="task-main-content">
                <div style="display:flex; align-items:center; flex:1; min-width:0">
                    <div class="task-checkbox" onclick="toggleTask(${index})">
                        ${task.completed ? '✓' : ''}
                    </div>
                    <span class="task-text">${task.text}</span>
                    ${chevron}
                </div>
                <button class="delete-btn" onclick="deleteTask(${index})">×</button>
            </div>
            ${subtasksHtml}
        `;
        taskList.appendChild(li);
    });
}

function toggleCollapse(index, event) {
    if (event) event.stopPropagation(); // Prevent drag/click interference
    if (tasks[index].collapsed === undefined) tasks[index].collapsed = false;
    tasks[index].collapsed = !tasks[index].collapsed;
    saveTasks();
    renderTasks();
}

function addTask(text) {
    tasks.unshift({ text, completed: false, subtasks: [] }); // Add to top
    saveTasks();
    renderTasks();
}

// Auto-Scroll Logic
let scrollInterval;
let scrollSpeed = 0;

function stopAutoScroll() {
    if (scrollInterval) {
        clearInterval(scrollInterval);
        scrollInterval = null;
        scrollSpeed = 0;
    }
}

function startAutoScroll() {
    if (scrollInterval) return;
    scrollInterval = setInterval(() => {
        if (scrollSpeed !== 0) {
            taskList.scrollTop += scrollSpeed;
        }
    }, 16); // ~60fps
}

// Drag & Drop Functions
function dragStart(e) {
    // Check if dragging a subtask
    if (e.target.closest('.subtask-item')) {
        dragType = 'sub';
        const subEl = e.target.closest('.subtask-item');
        dragStartIndex = +subEl.dataset.parentIndex;
        dragSubIndex = +subEl.dataset.subIndex;
        e.stopPropagation(); // Avoid triggering parent drag
    } else {
        dragType = 'main';
        dragStartIndex = +this.closest('.task-item').dataset.index;
        dragSubIndex = null;
    }

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    // Visual feedback
    if (dragType === 'main') this.classList.add('dragging');
    else e.target.closest('.subtask-item').classList.add('dragging');
}

function dragEnter(e) {
    e.preventDefault();
    if (dragType === 'main') this.classList.add('drag-over');
    else {
        // If highlighting subtasks, maybe add class to them?
    }
}

function dragLeave(e) {
    this.classList.remove('drag-over');
    this.classList.remove('nest-target');
}

function dragOver(e) {
    e.preventDefault();

    // Auto-Scroll Check
    const listRect = taskList.getBoundingClientRect();
    const scrollThreshold = 80;
    if (e.clientY < listRect.top + scrollThreshold) {
        scrollSpeed = -15;
        startAutoScroll();
    } else if (e.clientY > listRect.bottom - scrollThreshold) {
        scrollSpeed = 15;
        startAutoScroll();
    } else {
        stopAutoScroll();
    }

    const item = this.closest('.task-item');
    if (!item) return;

    // Reset Classes
    item.classList.remove('nest-target');
    item.classList.remove('drag-over');

    const rect = item.getBoundingClientRect();
    const offset = e.clientY - rect.top;
    const height = rect.height;

    if (dragType === 'main') {
        const draggedTask = tasks[dragStartIndex];
        const hasSubtasks = draggedTask.subtasks && draggedTask.subtasks.length > 0;

        // Nesting Zone: Expanded to Middle 80% (10% to 90%)
        if (!hasSubtasks && offset > height * 0.1 && offset < height * 0.9) {
            const targetIndex = +item.dataset.index;
            if (targetIndex !== dragStartIndex) {
                item.classList.add('nest-target');
            }
        } else {
            item.classList.add('drag-over');
        }
    } else if (dragType === 'sub') {
        // If hovering over a subtask, let's just highlight the parent container's drag-over for now
        // to simplify visual cues. Or relies on drop logic.
        // If we drop on the main task -> Un-nest or Nest depending on zone.

        // Check nesting zone on parent
        const isNesting = (offset > height * 0.1 && offset < height * 0.9);
        if (isNesting) {
            item.classList.add('nest-target');
        } else {
            item.classList.add('drag-over');
        }
    }
}

function dragDrop(e) {
    e.preventDefault();
    stopAutoScroll();
    this.classList.remove('dragging');
    this.classList.remove('drag-over');
    this.classList.remove('nest-target');

    // Clean up subtask dragging class if needed
    document.querySelectorAll('.subtask-item.dragging').forEach(el => el.classList.remove('dragging'));

    const targetSubtask = e.target.closest('.subtask-item');
    const targetMain = this.closest('.task-item');
    if (!targetMain) return;

    const dragEndIndex = +targetMain.dataset.index;

    // Same-item checks
    if (dragType === 'main' && dragStartIndex === dragEndIndex) return;

    if (dragType === 'main') {
        const draggedTask = tasks[dragStartIndex];
        const firstCheckedIndex = tasks.findIndex(t => t.completed);
        const hasSubtasks = draggedTask.subtasks && draggedTask.subtasks.length > 0;
        const rect = targetMain.getBoundingClientRect();
        const offset = e.clientY - rect.top;
        const height = rect.height;
        const isNesting = !hasSubtasks && (offset > height * 0.1 && offset < height * 0.9);

        if (isNesting) {
            nestTask(dragStartIndex, dragEndIndex);
        } else {
            if (!draggedTask.completed) {
                if (firstCheckedIndex !== -1 && dragEndIndex >= firstCheckedIndex) {
                    reorderTask(dragStartIndex, firstCheckedIndex > 0 ? firstCheckedIndex - 1 : 0);
                    return;
                }
            }
            reorderTask(dragStartIndex, dragEndIndex);
        }
    } else if (dragType === 'sub') {
        const parentIndex = dragStartIndex;
        const subIndex = dragSubIndex;

        // If dropped ON a subtask element -> Reorder within that sublist (or move to it)
        if (targetSubtask) {
            const targetParentIndex = +targetSubtask.dataset.parentIndex;
            const targetSubIndex = +targetSubtask.dataset.subIndex;

            if (targetParentIndex === parentIndex) {
                // Reorder within same list
                reorderSubtask(parentIndex, subIndex, targetSubIndex);
            } else {
                // Move to another sublist (insert at specific pos)
                moveSubtaskToSublistAt(parentIndex, subIndex, targetParentIndex, targetSubIndex);
            }
        } else {
            // Dropped on Main Task area (not specifically on a subtask)
            // Check zones
            const rect = targetMain.getBoundingClientRect();
            const offset = e.clientY - rect.top;
            const height = rect.height;
            const isNesting = (offset > height * 0.1 && offset < height * 0.9);

            // If dragging subtask on its OWN parent
            if (parentIndex === dragEndIndex) {
                if (!isNesting) {
                    // Dropped on Top/Bottom of OWN parent -> Un-nest & place adjacent
                    convertSubtaskToMain(parentIndex, subIndex, dragEndIndex + (offset > height / 2 ? 1 : 0));
                }
                // Else: Dropped in middle of own parent -> Do nothing (stay nested)
            } else {
                // Dropped on text of ANOTHER task
                if (isNesting) {
                    // Move to that task's sublist (append)
                    moveSubtaskToSublist(parentIndex, subIndex, dragEndIndex);
                } else {
                    // Un-nest -> Become Main Task adjacent to target
                    convertSubtaskToMain(parentIndex, subIndex, dragEndIndex + (offset > height / 2 ? 1 : 0));
                }
            }
        }
    }
}

function reorderTask(fromIndex, toIndex) {
    const item = tasks.splice(fromIndex, 1)[0];
    tasks.splice(toIndex, 0, item);
    saveTasks();
    renderTasks();
}

function nestTask(draggedIndex, targetIndex) {
    const taskToNest = tasks[draggedIndex];
    let actualTargetIndex = targetIndex;
    if (draggedIndex < targetIndex) actualTargetIndex--;
    tasks.splice(draggedIndex, 1);

    if (!tasks[actualTargetIndex].subtasks) tasks[actualTargetIndex].subtasks = [];
    tasks[actualTargetIndex].subtasks.push(taskToNest);
    saveTasks();
    renderTasks();
}

function reorderSubtask(parentIndex, fromSub, toSub) {
    const parent = tasks[parentIndex];
    const item = parent.subtasks.splice(fromSub, 1)[0];
    parent.subtasks.splice(toSub, 0, item);
    saveTasks();
    renderTasks();
}

function moveSubtaskToSublist(fromParentIndex, fromSub, toParentIndex) {
    const item = tasks[fromParentIndex].subtasks.splice(fromSub, 1)[0];
    if (!tasks[toParentIndex].subtasks) tasks[toParentIndex].subtasks = [];
    tasks[toParentIndex].subtasks.push(item);
    saveTasks();
    renderTasks();
}

function moveSubtaskToSublistAt(fromParentIndex, fromSub, toParentIndex, toSubIndex) {
    const item = tasks[fromParentIndex].subtasks.splice(fromSub, 1)[0];
    if (!tasks[toParentIndex].subtasks) tasks[toParentIndex].subtasks = [];
    tasks[toParentIndex].subtasks.splice(toSubIndex, 0, item);
    saveTasks();
    renderTasks();
}

function convertSubtaskToMain(parentIndex, subIndex, toMainIndex) {
    // Safety check for bounds
    if (toMainIndex < 0) toMainIndex = 0;
    if (toMainIndex > tasks.length) toMainIndex = tasks.length;

    const item = tasks[parentIndex].subtasks.splice(subIndex, 1)[0];

    // If moving down and parent index is before target, index might shift?
    // Actually no, we remove from subtasks (does not affect main task array length).
    // So insertion index is stable relative to main tasks.

    tasks.splice(toMainIndex, 0, item);
    saveTasks();
    renderTasks();
}

window.toggleTask = function (index) {
    const task = tasks[index];
    const wasCompleted = task.completed;

    task.completed = !wasCompleted;
    saveTasks();

    const itemEl = document.getElementById(`task-item-${index}`);
    if (itemEl) {
        itemEl.classList.toggle('completed');
        const checkbox = itemEl.querySelector('.task-checkbox');
        checkbox.innerHTML = task.completed ? '✓' : '';
    }
    document.getElementById('task-count').textContent = `${tasks.filter(t => !t.completed).length} left`;

    if (task.completed) {
        setTimeout(() => {
            const currentIndex = tasks.indexOf(task);
            if (currentIndex !== -1) {
                tasks.splice(currentIndex, 1);
                tasks.push(task);
                saveTasks();
                renderTasks();
            }
        }, 600);
    } else {
        tasks.splice(index, 1);
        const firstChecked = tasks.findIndex(t => t.completed);
        if (firstChecked === -1) {
            tasks.push(task);
        } else {
            tasks.splice(firstChecked, 0, task);
        }
        saveTasks();
        renderTasks();
    }
}

window.deleteTask = function (index) {
    tasks.splice(index, 1);
    saveTasks();
    renderTasks();
}

window.toggleSubtask = function (parentIndex, subIndex) {
    const parent = tasks[parentIndex];
    const sub = parent.subtasks[subIndex];
    sub.completed = !sub.completed;
    saveTasks();

    if (sub.completed) {
        renderTasks();
        setTimeout(() => {
            const currentParent = tasks[parentIndex];
            if (currentParent && currentParent.subtasks && currentParent.subtasks[subIndex] === sub) {
                const removed = currentParent.subtasks.splice(subIndex, 1)[0];
                currentParent.subtasks.push(removed);
                saveTasks();
                renderTasks();
            }
        }, 600);
    } else {
        parent.subtasks.splice(subIndex, 1);
        const firstChecked = parent.subtasks.findIndex(s => s.completed);
        if (firstChecked === -1) {
            parent.subtasks.push(sub);
        } else {
            parent.subtasks.splice(firstChecked, 0, sub);
        }
        saveTasks();
        renderTasks();
    }
}

window.deleteSubtask = function (parentIndex, subIndex) {
    tasks[parentIndex].subtasks.splice(subIndex, 1);
    saveTasks();
    renderTasks();
}

function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

// Task Modal
const taskModal = document.getElementById('task-modal');
document.getElementById('add-task-btn').onclick = () => {
    taskModal.classList.remove('hidden');
    document.getElementById('new-task-input').focus();
};
document.getElementById('cancel-task-btn').onclick = () => taskModal.classList.add('hidden');
document.getElementById('save-task-btn').onclick = () => {
    const input = document.getElementById('new-task-input');
    if (input.value.trim()) {
        addTask(input.value.trim());
        input.value = '';
        taskModal.classList.add('hidden');
    }
};

// --- CALENDAR ---
let currentDate = new Date();
let selectedDateKey = null;

// Month Nav
document.getElementById('prev-month-btn').onclick = () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
};
document.getElementById('next-month-btn').onclick = () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
};

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    document.getElementById('current-month-display').textContent =
        new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });

    calendarGrid.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Empty slots
    for (let i = 0; i < firstDay; i++) {
        calendarGrid.appendChild(document.createElement('div'));
    }

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const el = document.createElement('div');
        el.className = 'calendar-day';
        el.textContent = day;

        if (day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear()) {
            el.classList.add('today');
        }

        if (events[dateKey] && events[dateKey].length > 0) {
            el.classList.add('has-event');
        }

        el.onclick = () => openDayView(dateKey);
        calendarGrid.appendChild(el);
    }
}

// Day View Logic
const dayViewModal = document.getElementById('day-view-modal');
const dayViewDate = document.getElementById('day-view-date');
const dayTimeline = document.getElementById('day-timeline');

function openDayView(dateKey) {
    selectedDateKey = dateKey;
    dayViewDate.textContent = new Date(dateKey).toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' });
    dayViewModal.classList.remove('hidden');
    renderTimeline();
}

document.getElementById('close-day-view-btn').onclick = () => dayViewModal.classList.add('hidden');

function renderTimeline() {
    dayTimeline.innerHTML = '';
    const dayEvents = events[selectedDateKey] || [];

    // 1. Render Time Slots (00:00 - 23:00)
    for (let i = 0; i < 24; i++) {
        const slot = document.createElement('div');
        slot.className = 'time-slot';
        slot.innerHTML = `<div class="time-label">${i}:00</div>`;
        dayTimeline.appendChild(slot);
    }

    // 2. Render Events
    dayEvents.forEach(event => {
        const [startH, startM] = event.start.split(':').map(Number);
        const [endH, endM] = event.end.split(':').map(Number);

        // Calculate position (60px per hour)
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        const durationMinutes = endMinutes - startMinutes;

        // Add 16px offset to account for container padding
        const top = startMinutes + 16;
        const height = durationMinutes;

        const el = document.createElement('div');
        el.className = 'timeline-event';
        el.style.top = `${top}px`;
        el.style.height = `${height}px`;
        el.innerHTML = `<strong>${event.title}</strong><br>${event.start} - ${event.end}`;
        dayTimeline.appendChild(el);
    });
}

// Event Modal
const eventModal = document.getElementById('event-modal');
document.getElementById('add-event-btn').onclick = () => {
    eventModal.classList.remove('hidden');
    document.getElementById('new-event-title').focus();
};
document.getElementById('cancel-event-btn').onclick = () => eventModal.classList.add('hidden');

document.getElementById('save-event-btn').onclick = () => {
    const title = document.getElementById('new-event-title').value.trim();
    const start = document.getElementById('new-event-start').value;
    const end = document.getElementById('new-event-end').value;

    if (title && start && end) {
        if (!events[selectedDateKey]) events[selectedDateKey] = [];

        // Handle overnight events (simple split)
        if (end < start) {
            // Part 1: start -> 23:59
            events[selectedDateKey].push({ title, start, end: '23:59' });

            // Part 2: Next day 00:00 -> end
            const nextDay = new Date(selectedDateKey);
            nextDay.setDate(nextDay.getDate() + 1);
            const nextKey = nextDay.toISOString().split('T')[0];

            if (!events[nextKey]) events[nextKey] = [];
            events[nextKey].push({ title, start: '00:00', end });
        } else {
            events[selectedDateKey].push({ title, start, end });
        }

        localStorage.setItem('events', JSON.stringify(events));
        renderTimeline();
        renderCalendar(); // Update dots

        // Reset & Close
        document.getElementById('new-event-title').value = '';
        document.getElementById('new-event-start').value = '';
        document.getElementById('new-event-end').value = '';
        eventModal.classList.add('hidden');
    } else {
        alert('Please fill in all fields');
    }
};

const timerToggle = document.getElementById('timer-toggle');
const FULL_DASH_ARRAY = 283;

// Slider Logic
durationSlider.oninput = () => {
    if (!isFocusing) {
        const mins = durationSlider.value;
        durationValue.textContent = mins;
        focusTime = mins * 60;
        initialFocusTime = focusTime;
        timerDisplay.textContent = formatTime(focusTime);
        setCircleDashoffset(focusTime);
    }
};

function setCircleDashoffset(timeLeft) {
    const rawTimeFraction = timeLeft / initialFocusTime;
    const circleDashoffset = -(FULL_DASH_ARRAY - (FULL_DASH_ARRAY * rawTimeFraction));
    if (progressRing) progressRing.style.strokeDashoffset = circleDashoffset;
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

timerToggle.onclick = () => {
    if (isFocusing) {
        clearInterval(focusInterval);
        timerToggle.textContent = "Start Focus";
        timerToggle.style.background = "var(--accent)";
        isFocusing = false;
        durationSlider.disabled = false;
    } else {
        isFocusing = true;
        timerToggle.textContent = "Stop";
        timerToggle.style.background = "var(--danger)";
        durationSlider.disabled = true;

        focusInterval = setInterval(() => {
            focusTime--;
            timerDisplay.textContent = formatTime(focusTime);
            setCircleDashoffset(focusTime);

            if (focusTime <= 0) {
                clearInterval(focusInterval);
                isFocusing = false;
                timerToggle.textContent = "Start Focus";
                durationSlider.disabled = false;
                alert("Focus session complete!");
            }
        }, 1000);
    }
};

// Init
renderTasks();
