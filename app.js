const API_URL = window.location.origin;
let ws;
let sessionId = localStorage.getItem('agentpulse_session_id');
let agents = {};
let selectedAgent = null;
let configured = { claude: false, gpt4: false, gemini: false };

// Generate session ID if not exists
if (!sessionId) {
    sessionId = 'session_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('agentpulse_session_id', sessionId);
}

// WebSocket connection
function connectWebSocket() {
    ws = new WebSocket(`ws://${window.location.host}?sessionId=${sessionId}`);
    
    ws.onopen = () => {
        updateConnectionStatus(true);
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch(data.type) {
            case 'init':
                agents = data.agents;
                configured = data.configured || { claude: false, gpt4: false, gemini: false };
                renderAgents();
                renderLogs(data.logs);
                updateConfigurationUI();
                break;
            case 'agent_update':
                agents[data.data.id] = data.data;
                renderAgents();
                break;
            case 'log':
                addLogEntry(data.data);
                break;
            case 'reset':
                location.reload();
                break;
        }
    };

    ws.onerror = () => {
        updateConnectionStatus(false);
    };

    ws.onclose = () => {
        updateConnectionStatus(false);
        setTimeout(connectWebSocket, 3000);
    };
}

function updateConnectionStatus(connected) {
    const dot = document.getElementById('connectionDot');
    const text = document.getElementById('connectionText');
    
    if (connected) {
        dot.classList.remove('disconnected');
        text.textContent = 'Połączono';
    } else {
        dot.classList.add('disconnected');
        text.textContent = 'Rozłączono';
    }
}

function updateConfigurationUI() {
    const settingsBtn = document.getElementById('settingsBtn');
    const hasAnyKey = configured.claude || configured.gpt4 || configured.gemini;
    
    if (hasAnyKey) {
        settingsBtn.classList.remove('unconfigured');
        settingsBtn.textContent = '⚙️ Ustawienia';
    } else {
        settingsBtn.classList.add('unconfigured');
        settingsBtn.textContent = '⚠️ Skonfiguruj klucze API';
    }
    
    // Update badges in modal
    document.getElementById('claudeBadge').className = `badge ${configured.claude ? 'configured' : 'not-configured'}`;
    document.getElementById('claudeBadge').textContent = configured.claude ? 'Skonfigurowano' : 'Nie skonfigurowano';
    
    document.getElementById('openaiBADGE').className = `badge ${configured.gpt4 ? 'configured' : 'not-configured'}`;
    document.getElementById('openaiBADGE').textContent = configured.gpt4 ? 'Skonfigurowano' : 'Nie skonfigurowano';
    
    document.getElementById('googleBadge').className = `badge ${configured.gemini ? 'configured' : 'not-configured'}`;
    document.getElementById('googleBadge').textContent = configured.gemini ? 'Skonfigurowano' : 'Nie skonfigurowano';
    
    // Update agent selector buttons
    updateAgentButtons();
    
    // Show modal if no keys configured
    if (!hasAnyKey && !localStorage.getItem('agentpulse_dismissed_setup')) {
        openSettings();
    }
}

function updateAgentButtons() {
    const buttons = document.querySelectorAll('.agent-btn');
    buttons.forEach(btn => {
        const agent = btn.dataset.agent;
        if (agent === 'all') {
            btn.disabled = !configured.claude && !configured.gpt4 && !configured.gemini;
        } else {
            btn.disabled = !configured[agent];
        }
    });
    
    document.getElementById('submitTask').disabled = !selectedAgent || (selectedAgent !== 'all' && !configured[selectedAgent]);
}

function renderAgents() {
    const grid = document.getElementById('agentsGrid');
    grid.innerHTML = Object.values(agents).map(agent => {
        const isConfigured = configured[agent.id];
        return `
        <div class="agent-card ${!isConfigured ? 'disabled' : ''}">
            <div class="agent-header">
                <div class="agent-info">
                    <h3>${agent.name}</h3>
                    <div class="agent-type">${agent.type}</div>
                </div>
                <span class="status-badge status-${isConfigured ? agent.status : 'disabled'}">
                    ${!isConfigured ? '🔒 Nie skonfigurowano' :
                      agent.status === 'working' ? '⚡ Pracuje' : 
                      agent.status === 'active' ? '✓ Aktywny' : '⏸ Bezczynny'}
                </span>
            </div>
            
            <div class="current-task">
                ${agent.currentTask ? 
                    `<div class="task-title">${agent.currentTask.substring(0, 100)}${agent.currentTask.length > 100 ? '...' : ''}</div>` :
                    `<div class="task-empty">${!isConfigured ? 'Wymagana konfiguracja klucza API' : 'Brak aktywnego zadania'}</div>`
                }
            </div>
            
            <div class="agent-metrics">
                <div class="metric">
                    <div class="metric-value">${agent.tasksCompleted}</div>
                    <div class="metric-label">Zadania</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${(agent.tokensUsed / 1000).toFixed(1)}k</div>
                    <div class="metric-label">Tokeny</div>
                </div>
                <div class="metric">
                    <div class="metric-value">$${agent.totalCost.toFixed(4)}</div>
                    <div class="metric-label">Koszt</div>
                </div>
            </div>
        </div>
    `}).join('');

    updateGlobalStats();
}

function updateGlobalStats() {
    const activeCount = Object.values(agents).filter(a => a.status === 'working').length;
    const totalTasks = Object.values(agents).reduce((sum, a) => sum + a.tasksCompleted, 0);
    const totalCost = Object.values(agents).reduce((sum, a) => sum + a.totalCost, 0);

    document.getElementById('activeCount').textContent = activeCount;
    document.getElementById('totalTasks').textContent = totalTasks;
    document.getElementById('totalCost').textContent = '$' + totalCost.toFixed(4);
}

function addLogEntry(entry) {
    const logDiv = document.getElementById('activityLog');
    const entryEl = document.createElement('div');
    entryEl.className = `log-entry new ${entry.type === 'error' ? 'error' : ''}`;
    entryEl.innerHTML = `
        <div class="log-time">${new Date(entry.timestamp).toLocaleTimeString('pl-PL')}</div>
        <div class="log-message">
            <span class="log-agent">${entry.agent}</span>
            ${entry.message}
        </div>
    `;
    logDiv.insertBefore(entryEl, logDiv.firstChild);
    
    while (logDiv.children.length > 50) {
        logDiv.removeChild(logDiv.lastChild);
    }
}

function renderLogs(logs) {
    const logDiv = document.getElementById('activityLog');
    logDiv.innerHTML = logs.map(entry => `
        <div class="log-entry ${entry.type === 'error' ? 'error' : ''}">
            <div class="log-time">${new Date(entry.timestamp).toLocaleTimeString('pl-PL')}</div>
            <div class="log-message">
                <span class="log-agent">${entry.agent}</span>
                ${entry.message}
            </div>
        </div>
    `).join('');
}

// Settings modal
function openSettings() {
    document.getElementById('settingsModal').classList.add('show');
}

function closeSettings() {
    document.getElementById('settingsModal').classList.remove('show');
    localStorage.setItem('agentpulse_dismissed_setup', 'true');
}

async function saveApiKeys() {
    const apiKeys = {
        anthropic: document.getElementById('anthropicKey').value.trim() || null,
        openai: document.getElementById('openaiKey').value.trim() || null,
        google: document.getElementById('googleKey').value.trim() || null
    };
    
    // Filter out empty keys
    Object.keys(apiKeys).forEach(key => {
        if (!apiKeys[key]) delete apiKeys[key];
    });
    
    if (Object.keys(apiKeys).length === 0) {
        alert('Podaj przynajmniej jeden klucz API');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/session/keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, apiKeys })
        });
        
        const result = await response.json();
        
        if (result.success) {
            configured = result.configured;
            updateConfigurationUI();
            closeSettings();
            
            // Clear input fields for security
            document.getElementById('anthropicKey').value = '';
            document.getElementById('openaiKey').value = '';
            document.getElementById('googleKey').value = '';
            
            alert('Klucze API zapisane pomyślnie!');
        } else {
            alert('Błąd: ' + result.error);
        }
    } catch (error) {
        alert('Błąd: ' + error.message);
    }
}

// Agent selection
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.agent-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            
            document.querySelectorAll('.agent-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedAgent = btn.dataset.agent;
            updateAgentButtons();
        });
    });
});

// Submit task
document.getElementById('submitTask').addEventListener('click', async () => {
    const prompt = document.getElementById('taskPrompt').value.trim();
    
    if (!prompt || !selectedAgent) {
        alert('Wybierz agenta i wpisz prompt!');
        return;
    }

    const submitBtn = document.getElementById('submitTask');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Wysyłanie...';

    try {
        const endpoint = selectedAgent === 'all' 
            ? `/api/task/${sessionId}/all` 
            : `/api/task/${sessionId}/${selectedAgent}`;
            
        const response = await fetch(API_URL + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        const result = await response.json();
        
        if (selectedAgent === 'all') {
            showComparisonResults(result);
        } else {
            showResult(result, selectedAgent);
        }

        document.getElementById('taskPrompt').value = '';
        selectedAgent = null;
        document.querySelectorAll('.agent-btn').forEach(b => b.classList.remove('selected'));
    } catch (error) {
        alert('Błąd: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Wyślij zadanie';
        updateAgentButtons();
    }
});

function showResult(result, agentId) {
    if (!result.success) {
        alert('Błąd: ' + result.error);
        return;
    }

    const modal = document.getElementById('responseModal');
    document.getElementById('modalTitle').textContent = `Odpowiedź - ${agents[agentId].name}`;
    document.getElementById('responseText').textContent = result.response;
    document.getElementById('responseMeta').innerHTML = `
        <span>⏱️ ${result.responseTime}ms</span>
        <span>🔢 ${result.tokens} tokenów</span>
        <span>💰 $${result.cost.toFixed(4)}</span>
    `;
    modal.classList.add('show');
}

function showComparisonResults(results) {
    const modal = document.getElementById('responseModal');
    document.getElementById('modalTitle').textContent = 'Porównanie odpowiedzi';
    
    let html = '';
    Object.entries(results).forEach(([agentId, result]) => {
        if (result.success) {
            html += `
                <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e2e8f0;">
                    <h4 style="margin-bottom: 8px; color: #667eea;">${agents[agentId].name}</h4>
                    <div style="background: #f7fafc; padding: 12px; border-radius: 4px; margin-bottom: 8px;">
                        ${result.response}
                    </div>
                    <div style="font-size: 12px; color: #718096;">
                        ⏱️ ${result.responseTime}ms | 🔢 ${result.tokens} tokenów | 💰 $${result.cost.toFixed(4)}
                    </div>
                </div>
            `;
        }
    });
    
    document.getElementById('responseText').innerHTML = html;
    document.getElementById('responseMeta').innerHTML = '';
    modal.classList.add('show');
}

function closeModal() {
    document.getElementById('responseModal').classList.remove('show');
}

async function clearStats() {
    if (!confirm('Czy na pewno chcesz zresetować wszystkie statystyki?')) return;
    
    try {
        await fetch(`${API_URL}/api/reset/${sessionId}`, { method: 'POST' });
    } catch (error) {
        alert('Błąd: ' + error.message);
    }
}

// Initialize
connectWebSocket();
