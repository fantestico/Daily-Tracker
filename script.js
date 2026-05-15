let currentUser = null;

let state = {
    dates: [],
    tasks: [],
    pageOffset: 0
};

const DAYS_PER_PAGE = 10;
let currentViewDates = [];

// Elements
const tableThead = document.querySelector('#tracker-table thead');
const tableTbody = document.querySelector('#tracker-table tbody');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const addTaskBtn = document.getElementById('add-task-btn');

// Login Elements
const loginOverlay = document.getElementById('login-overlay');
const appContainer = document.querySelector('.app-container');
const loginBtn = document.getElementById('login-btn');
const usernameInput = document.getElementById('username-input');
const userGreeting = document.getElementById('user-greeting');
const logoutBtn = document.getElementById('logout-btn');

// Initialization
function init() {
    const sessionUser = sessionStorage.getItem('dailyTrackerUser');
    if (sessionUser) {
        loginUser(sessionUser);
    }
    
    loginBtn.addEventListener('click', handleLogin);
    usernameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    
    logoutBtn.addEventListener('click', handleLogout);
    
    prevPageBtn.addEventListener('click', prevPage);
    nextPageBtn.addEventListener('click', nextPage);
    addTaskBtn.addEventListener('click', addTask);
}

function handleLogin() {
    const user = usernameInput.value.trim();
    if (user) {
        loginUser(user);
    }
}

function loginUser(username) {
    currentUser = username;
    sessionStorage.setItem('dailyTrackerUser', username);
    userGreeting.textContent = `Hello, ${username}`;
    
    loginOverlay.classList.add('hidden');
    appContainer.classList.remove('hidden');
    
    loadState();
    updateViewDates();
    render();
}

function handleLogout() {
    currentUser = null;
    sessionStorage.removeItem('dailyTrackerUser');
    
    tableThead.innerHTML = '';
    tableTbody.innerHTML = '';
    
    appContainer.classList.add('hidden');
    loginOverlay.classList.remove('hidden');
    usernameInput.value = '';
}

function loadState() {
    const saved = localStorage.getItem(`dailyTracker_${currentUser}`);
    let parsed = null;
    if (saved) {
        try {
            parsed = JSON.parse(saved);
        } catch (e) {
            console.error("Failed to parse local storage", e);
        }
    }

    if (parsed) {
        state.tasks = parsed.tasks || [];
        state.pageOffset = parsed.pageOffset || 0;
        
        if (parsed.dayCount !== undefined && !parsed.dates) {
            state.tasks.forEach(t => {
                if (!t.completions) t.completions = {};
            });
        }
    } else {
        // First time load for this user
        state.pageOffset = 0;
        state.tasks = [];
        saveState();
    }
}

function saveState() {
    if (!currentUser) return;
    localStorage.setItem(`dailyTracker_${currentUser}`, JSON.stringify(state));
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function updateViewDates() {
    currentViewDates = [];
    const today = new Date();
    // The first date of the page is: today + (pageOffset * 10) days
    const startOffset = state.pageOffset * DAYS_PER_PAGE;
    
    // Create dates from (today + startOffset) up to (today + startOffset + 9)
    for (let i = 0; i < DAYS_PER_PAGE; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + startOffset + i);
        currentViewDates.push(d.toISOString().split('T')[0]);
    }
}

function prevPage() {
    state.pageOffset--;
    saveState();
    updateViewDates();
    render();
}

function nextPage() {
    state.pageOffset++;
    saveState();
    updateViewDates();
    render();
}

// Rendering
function render() {
    renderHeaders();
    renderTasks();
}

function renderHeaders() {
    tableThead.innerHTML = '';
    
    // Top sub-row (Progress fractions)
    const trTop = document.createElement('tr');
    const thEmpty = document.createElement('th');
    thEmpty.className = 'tasks-header';
    trTop.appendChild(thEmpty);
    
    currentViewDates.forEach(dateStr => {
        const thProgress = document.createElement('th');
        
        // Calculate progress for this date
        const total = state.tasks.length;
        const completed = state.tasks.filter(t => t.completions && t.completions[dateStr]).length;
        const percentage = total === 0 ? 0 : (completed / total) * 100;
        
        thProgress.innerHTML = `
            <div class="progress-text">${completed}/${total}</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percentage}%"></div>
            </div>
        `;
        trTop.appendChild(thProgress);
    });
    tableThead.appendChild(trTop);
    
    // Bottom sub-row (Date labels)
    const trBottom = document.createElement('tr');
    const thTasks = document.createElement('th');
    thTasks.className = 'tasks-header';
    thTasks.textContent = 'Tasks';
    trBottom.appendChild(thTasks);
    
    currentViewDates.forEach(dateStr => {
        const thDay = document.createElement('th');
        // Parse date considering timezone correctly
        const parts = dateStr.split('-');
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        thDay.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        trBottom.appendChild(thDay);
    });
    tableThead.appendChild(trBottom);
}

function renderTasks() {
    tableTbody.innerHTML = '';
    state.tasks.forEach((task, index) => {
        const tr = document.createElement('tr');
        
        // Task Name Cell
        const tdTask = document.createElement('td');
        tdTask.className = 'task-cell';
        
        const spanName = document.createElement('span');
        spanName.textContent = task.name || 'Untitled Task';
        
        tdTask.appendChild(spanName);
        
        // Inline editing
        tdTask.addEventListener('dblclick', () => {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'task-input';
            input.value = task.name;
            
            const saveEdit = () => {
                const newName = input.value.trim();
                state.tasks[index].name = newName;
                saveState();
                renderTasks();
            };
            
            input.addEventListener('blur', saveEdit);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') renderTasks(); // cancel edit
            });
            
            tdTask.innerHTML = '';
            tdTask.appendChild(input);
            input.focus();
        });
        
        tr.appendChild(tdTask);
        
        // Day Checkboxes
        currentViewDates.forEach(dateStr => {
            const tdDay = document.createElement('td');
            tdDay.className = 'day-cell';
            
            const isChecked = task.completions && task.completions[dateStr];
            
            const checkbox = document.createElement('div');
            checkbox.className = `checkbox-container ${isChecked ? 'checked' : ''}`;
            
            checkbox.innerHTML = `
                <svg class="checkmark" viewBox="0 0 20 20">
                    <path d="M4 10 L8 14 L16 6"></path>
                </svg>
            `;
            
            checkbox.addEventListener('click', () => {
                if (!state.tasks[index].completions) {
                    state.tasks[index].completions = {};
                }
                if (state.tasks[index].completions[dateStr]) {
                    delete state.tasks[index].completions[dateStr];
                } else {
                    state.tasks[index].completions[dateStr] = true;
                }
                saveState();
                
                // Toggle UI and re-render headers to update progress
                if (state.tasks[index].completions[dateStr]) {
                    checkbox.classList.add('checked');
                } else {
                    checkbox.classList.remove('checked');
                }
                renderHeaders();
            });
            
            tdDay.appendChild(checkbox);
            tr.appendChild(tdDay);
        });
        
        // Delete button
        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.innerHTML = '✕';
        delBtn.title = 'Delete Task';
        delBtn.addEventListener('click', () => {
            deleteTask(task.id);
        });
        tr.appendChild(delBtn);
        
        tableTbody.appendChild(tr);
    });
}

function addTask() {
    const newTask = {
        id: generateId(),
        name: "",
        completions: {}
    };
    state.tasks.push(newTask);
    saveState();
    renderTasks();
    renderHeaders(); // Since total tasks increased, update progress
    
    // Focus the newly added task for editing immediately
    const rows = tableTbody.querySelectorAll('tr');
    const lastRowCell = rows[rows.length - 1].querySelector('.task-cell');
    
    // Trigger dblclick event logic directly
    lastRowCell.dispatchEvent(new Event('dblclick'));
}

function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveState();
    renderTasks();
    renderHeaders(); // Total tasks decreased
}

// Start
init();
