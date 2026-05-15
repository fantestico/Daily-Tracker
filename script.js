// State structure
// tasks: [{ id, name, completions: { '2026-05-15': true } }]
// pageOffset: 0 (0 means current page ends today, -1 means ends 10 days before today)

let state = {
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

// Initialization
function init() {
    loadState();
    updateViewDates();
    render();
    
    prevPageBtn.addEventListener('click', prevPage);
    nextPageBtn.addEventListener('click', nextPage);
    addTaskBtn.addEventListener('click', addTask);
}

function loadState() {
    const saved = localStorage.getItem('dailyTracker');
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
        
        // Handle migration from previous format if needed
        if (parsed.dayCount !== undefined && !parsed.dates) {
            // Already migrated in previous step or needs migration again? 
            // Since it was already migrated to dates format earlier,
            // the old "days" array shouldn't exist.
            // But if they have it from the first stitch, it might.
            // We just let the previous migration logic be if needed,
            // but assuming the previous step ran, parsed.tasks has completions.
            state.tasks.forEach(t => {
                if (!t.completions) t.completions = {};
            });
        }
    } else {
        // First time load
        state.pageOffset = 0;
        state.tasks = [];
        saveState();
    }
}

function saveState() {
    localStorage.setItem('dailyTracker', JSON.stringify(state));
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

// --- PWA Support ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(reg => {
            console.log('ServiceWorker registered:', reg.scope);
        }).catch(err => {
            console.log('ServiceWorker registration failed:', err);
        });
    });
}

let deferredPrompt;
const downloadBtn = document.getElementById('download-app-btn');

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI notify the user they can install the PWA
    downloadBtn.classList.remove('hidden');
});

downloadBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
        // Show the install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        }
        deferredPrompt = null;
        downloadBtn.classList.add('hidden');
    }
});

window.addEventListener('appinstalled', () => {
    // Hide the app-provided install promotion
    downloadBtn.classList.add('hidden');
});
