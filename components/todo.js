const TODO_STORAGE_KEY = 'user_todos';
let todos = JSON.parse(localStorage.getItem(TODO_STORAGE_KEY)) || [];

function saveTodos() {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));
    renderTodos();
}

function renderTodos() {
    const list = document.getElementById('todo-list');
    if (!list) return;

    list.innerHTML = todos.map((todo, index) => `
        <div class="todo-item">
            <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''} onchange="toggleTodo(${index})">
            <span class="todo-text ${todo.completed ? 'completed' : ''}">${String(todo.text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
            <button class="todo-delete" onclick="deleteTodo(${index})" title="Delete Todo">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
        </div>
    `).join('');
}

window.addTodo = () => {
    const input = document.getElementById('todo-input');
    const text = input.value.trim();
    if (text) {
        todos.push({ text, completed: false });
        input.value = '';
        saveTodos();
    }
}

window.toggleTodo = (index) => {
    if (todos[index]) {
        todos[index].completed = !todos[index].completed;
        saveTodos();
    }
}

window.deleteTodo = (index) => {
    todos.splice(index, 1);
    saveTodos();
}

document.addEventListener('DOMContentLoaded', () => {
    renderTodos();
    const input = document.getElementById('todo-input');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                window.addTodo();
            }
        });
    }
});
