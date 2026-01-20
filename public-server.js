const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();

const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use(express.static('public-frontend'));

// Store active sessions with their API keys (in-memory)
// In production, use Redis or similar for persistence
const sessions = new Map();

// Activity log per session
const sessionLogs = new Map();

// Broadcast to specific session
function broadcastToSession(sessionId, data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client.sessionId === sessionId) {
            client.send(JSON.stringify(data));
        }
    });
}

// Add log entry for session
function addLog(sessionId, agentName, message, type = 'info') {
    if (!sessionLogs.has(sessionId)) {
        sessionLogs.set(sessionId, []);
    }
    
    const entry = {
        timestamp: new Date().toISOString(),
        agent: agentName,
        message,
        type
    };
    
    const logs = sessionLogs.get(sessionId);
    logs.unshift(entry);
    if (logs.length > 100) logs.pop();
    
    broadcastToSession(sessionId, {
        type: 'log',
        data: entry
    });
}

// Get or create session data
function getSessionData(sessionId) {
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, {
            agents: {
                claude: {
                    id: 'claude',
                    name: 'Claude Sonnet 4',
                    type: 'Anthropic',
                    status: 'idle',
                    currentTask: null,
                    tasksCompleted: 0,
                    tokensUsed: 0,
                    totalCost: 0,
                    lastActive: null,
                    model: 'claude-sonnet-4-20250514'
                },
                gpt4: {
                    id: 'gpt4',
                    name: 'GPT-4 Turbo',
                    type: 'OpenAI',
                    status: 'idle',
                    currentTask: null,
                    tasksCompleted: 0,
                    tokensUsed: 0,
                    totalCost: 0,
                    lastActive: null,
                    model: 'gpt-4-turbo-preview'
                },
                gemini: {
                    id: 'gemini',
                    name: 'Gemini Pro',
                    type: 'Google',
                    status: 'idle',
                    currentTask: null,
                    tasksCompleted: 0,
                    tokensUsed: 0,
                    totalCost: 0,
                    lastActive: null,
                    model: 'gemini-pro'
                }
            },
            apiKeys: {
                anthropic: null,
                openai: null,
                google: null
            }
        });
    }
    return sessions.get(sessionId);
}

// Update agent status
function updateAgent(sessionId, agentId, updates) {
    const session = getSessionData(sessionId);
    session.agents[agentId] = { ...session.agents[agentId], ...updates };
    
    broadcastToSession(sessionId, {
        type: 'agent_update',
        data: session.agents[agentId]
    });
}

// ========== API KEY VALIDATION ==========
function validateApiKey(provider, apiKey) {
    if (!apiKey || typeof apiKey !== 'string') return false;
    
    switch(provider) {
        case 'anthropic':
            return apiKey.startsWith('sk-ant-');
        case 'openai':
            return apiKey.startsWith('sk-');
        case 'google':
            return apiKey.length > 20; // Basic validation
        default:
            return false;
    }
}

// ========== CLAUDE API ==========
async function callClaude(sessionId, prompt, apiKey) {
    const agentId = 'claude';
    const session = getSessionData(sessionId);
    
    updateAgent(sessionId, agentId, { status: 'working', currentTask: prompt });
    addLog(sessionId, session.agents[agentId].name, `Rozpoczęto zadanie: ${prompt.substring(0, 50)}...`);

    try {
        const anthropic = new Anthropic({ apiKey });
        const startTime = Date.now();
        
        const message = await anthropic.messages.create({
            model: session.agents[agentId].model,
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }],
        });

        const responseTime = Date.now() - startTime;
        const inputTokens = message.usage.input_tokens;
        const outputTokens = message.usage.output_tokens;
        const totalTokens = inputTokens + outputTokens;
        
        const cost = (inputTokens * 3 / 1000000) + (outputTokens * 15 / 1000000);

        updateAgent(sessionId, agentId, {
            status: 'idle',
            currentTask: null,
            tasksCompleted: session.agents[agentId].tasksCompleted + 1,
            tokensUsed: session.agents[agentId].tokensUsed + totalTokens,
            totalCost: session.agents[agentId].totalCost + cost,
            lastActive: new Date().toISOString()
        });

        addLog(sessionId, session.agents[agentId].name, `Zakończono w ${responseTime}ms | Tokeny: ${totalTokens} | Koszt: $${cost.toFixed(4)}`);

        return {
            success: true,
            response: message.content[0].text,
            tokens: totalTokens,
            cost,
            responseTime
        };
    } catch (error) {
        updateAgent(sessionId, agentId, { status: 'idle', currentTask: null });
        addLog(sessionId, session.agents[agentId].name, `Błąd: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}

// ========== OPENAI API ==========
async function callOpenAI(sessionId, prompt, apiKey) {
    const agentId = 'gpt4';
    const session = getSessionData(sessionId);
    
    updateAgent(sessionId, agentId, { status: 'working', currentTask: prompt });
    addLog(sessionId, session.agents[agentId].name, `Rozpoczęto zadanie: ${prompt.substring(0, 50)}...`);

    try {
        const openai = new OpenAI({ apiKey });
        const startTime = Date.now();
        
        const completion = await openai.chat.completions.create({
            model: session.agents[agentId].model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1024
        });

        const responseTime = Date.now() - startTime;
        const inputTokens = completion.usage.prompt_tokens;
        const outputTokens = completion.usage.completion_tokens;
        const totalTokens = completion.usage.total_tokens;
        
        const cost = (inputTokens * 10 / 1000000) + (outputTokens * 30 / 1000000);

        updateAgent(sessionId, agentId, {
            status: 'idle',
            currentTask: null,
            tasksCompleted: session.agents[agentId].tasksCompleted + 1,
            tokensUsed: session.agents[agentId].tokensUsed + totalTokens,
            totalCost: session.agents[agentId].totalCost + cost,
            lastActive: new Date().toISOString()
        });

        addLog(sessionId, session.agents[agentId].name, `Zakończono w ${responseTime}ms | Tokeny: ${totalTokens} | Koszt: $${cost.toFixed(4)}`);

        return {
            success: true,
            response: completion.choices[0].message.content,
            tokens: totalTokens,
            cost,
            responseTime
        };
    } catch (error) {
        updateAgent(sessionId, agentId, { status: 'idle', currentTask: null });
        addLog(sessionId, session.agents[agentId].name, `Błąd: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}

// ========== GEMINI API ==========
async function callGemini(sessionId, prompt, apiKey) {
    const agentId = 'gemini';
    const session = getSessionData(sessionId);
    
    updateAgent(sessionId, agentId, { status: 'working', currentTask: prompt });
    addLog(sessionId, session.agents[agentId].name, `Rozpoczęto zadanie: ${prompt.substring(0, 50)}...`);

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const startTime = Date.now();
        const model = genAI.getGenerativeModel({ model: session.agents[agentId].model });
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const responseTime = Date.now() - startTime;
        const estimatedTokens = Math.ceil((prompt.length + text.length) / 4);
        const cost = estimatedTokens * 1 / 1000000;

        updateAgent(sessionId, agentId, {
            status: 'idle',
            currentTask: null,
            tasksCompleted: session.agents[agentId].tasksCompleted + 1,
            tokensUsed: session.agents[agentId].tokensUsed + estimatedTokens,
            totalCost: session.agents[agentId].totalCost + cost,
            lastActive: new Date().toISOString()
        });

        addLog(sessionId, session.agents[agentId].name, `Zakończono w ${responseTime}ms | Tokeny: ~${estimatedTokens} | Koszt: $${cost.toFixed(4)}`);

        return {
            success: true,
            response: text,
            tokens: estimatedTokens,
            cost,
            responseTime
        };
    } catch (error) {
        updateAgent(sessionId, agentId, { status: 'idle', currentTask: null });
        addLog(sessionId, session.agents[agentId].name, `Błąd: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}

// ========== API ENDPOINTS ==========

// Set API keys for session
app.post('/api/session/keys', (req, res) => {
    const { sessionId, apiKeys } = req.body;
    
    if (!sessionId) {
        return res.status(400).json({ error: 'Session ID required' });
    }
    
    const session = getSessionData(sessionId);
    
    // Validate and store API keys
    if (apiKeys.anthropic) {
        if (!validateApiKey('anthropic', apiKeys.anthropic)) {
            return res.status(400).json({ error: 'Invalid Anthropic API key' });
        }
        session.apiKeys.anthropic = apiKeys.anthropic;
    }
    
    if (apiKeys.openai) {
        if (!validateApiKey('openai', apiKeys.openai)) {
            return res.status(400).json({ error: 'Invalid OpenAI API key' });
        }
        session.apiKeys.openai = apiKeys.openai;
    }
    
    if (apiKeys.google) {
        if (!validateApiKey('google', apiKeys.google)) {
            return res.status(400).json({ error: 'Invalid Google API key' });
        }
        session.apiKeys.google = apiKeys.google;
    }
    
    addLog(sessionId, 'System', 'Klucze API zaktualizowane pomyślnie');
    
    res.json({ 
        success: true,
        configured: {
            claude: !!session.apiKeys.anthropic,
            gpt4: !!session.apiKeys.openai,
            gemini: !!session.apiKeys.google
        }
    });
});

// Get session status
app.get('/api/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = getSessionData(sessionId);
    
    res.json({
        agents: session.agents,
        configured: {
            claude: !!session.apiKeys.anthropic,
            gpt4: !!session.apiKeys.openai,
            gemini: !!session.apiKeys.google
        }
    });
});

// Get activity log
app.get('/api/logs/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const logs = sessionLogs.get(sessionId) || [];
    res.json(logs);
});

// Send task to specific agent
app.post('/api/task/:sessionId/:agentId', async (req, res) => {
    const { sessionId, agentId } = req.params;
    const { prompt } = req.body;
    
    const session = getSessionData(sessionId);

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    // Check if API key is configured
    let apiKey;
    switch (agentId) {
        case 'claude':
            apiKey = session.apiKeys.anthropic;
            if (!apiKey) {
                return res.status(400).json({ error: 'Anthropic API key not configured' });
            }
            break;
        case 'gpt4':
            apiKey = session.apiKeys.openai;
            if (!apiKey) {
                return res.status(400).json({ error: 'OpenAI API key not configured' });
            }
            break;
        case 'gemini':
            apiKey = session.apiKeys.google;
            if (!apiKey) {
                return res.status(400).json({ error: 'Google API key not configured' });
            }
            break;
        default:
            return res.status(400).json({ error: 'Invalid agent' });
    }

    let result;
    switch (agentId) {
        case 'claude':
            result = await callClaude(sessionId, prompt, apiKey);
            break;
        case 'gpt4':
            result = await callOpenAI(sessionId, prompt, apiKey);
            break;
        case 'gemini':
            result = await callGemini(sessionId, prompt, apiKey);
            break;
    }

    res.json(result);
});

// Send task to all agents (comparison mode)
app.post('/api/task/:sessionId/all', async (req, res) => {
    const { sessionId } = req.params;
    const { prompt } = req.body;
    
    const session = getSessionData(sessionId);

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    const tasks = [];
    
    if (session.apiKeys.anthropic) {
        tasks.push(callClaude(sessionId, prompt, session.apiKeys.anthropic));
    }
    if (session.apiKeys.openai) {
        tasks.push(callOpenAI(sessionId, prompt, session.apiKeys.openai));
    }
    if (session.apiKeys.google) {
        tasks.push(callGemini(sessionId, prompt, session.apiKeys.google));
    }

    if (tasks.length === 0) {
        return res.status(400).json({ error: 'No API keys configured' });
    }

    const results = await Promise.all(tasks);
    
    const response = {};
    let idx = 0;
    if (session.apiKeys.anthropic) response.claude = results[idx++];
    if (session.apiKeys.openai) response.gpt4 = results[idx++];
    if (session.apiKeys.google) response.gemini = results[idx++];

    res.json(response);
});

// Reset stats
app.post('/api/reset/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = getSessionData(sessionId);
    
    Object.keys(session.agents).forEach(agentId => {
        session.agents[agentId].tasksCompleted = 0;
        session.agents[agentId].tokensUsed = 0;
        session.agents[agentId].totalCost = 0;
        session.agents[agentId].status = 'idle';
        session.agents[agentId].currentTask = null;
    });
    
    sessionLogs.set(sessionId, []);
    broadcastToSession(sessionId, { type: 'reset' });
    res.json({ success: true });
});

// WebSocket connection
wss.on('connection', (ws, req) => {
    // Extract session ID from query params
    const url = new URL(req.url, 'http://localhost');
    const sessionId = url.searchParams.get('sessionId');
    
    if (!sessionId) {
        ws.close();
        return;
    }
    
    ws.sessionId = sessionId;
    console.log(`Client connected: ${sessionId}`);
    
    const session = getSessionData(sessionId);
    
    // Send current state to new client
    ws.send(JSON.stringify({
        type: 'init',
        agents: session.agents,
        logs: sessionLogs.get(sessionId) || [],
        configured: {
            claude: !!session.apiKeys.anthropic,
            gpt4: !!session.apiKeys.openai,
            gemini: !!session.apiKeys.google
        }
    }));

    ws.on('close', () => {
        console.log(`Client disconnected: ${sessionId}`);
    });
});

// Cleanup old sessions (run every hour)
setInterval(() => {
    const oneHourAgo = Date.now() - 3600000;
    sessions.forEach((session, sessionId) => {
        const hasRecentActivity = Object.values(session.agents).some(agent => 
            agent.lastActive && new Date(agent.lastActive).getTime() > oneHourAgo
        );
        
        if (!hasRecentActivity) {
            sessions.delete(sessionId);
            sessionLogs.delete(sessionId);
            console.log(`Cleaned up inactive session: ${sessionId}`);
        }
    });
}, 3600000);

const PORT = process.env.PORT || 3000;
// Dodano '0.0.0.0' w funkcji listen - kluczowe dla chmury!
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 AgentPulse server running on port ${PORT}`);
    console.log(`📊 WebSocket server ready`);
    console.log(`\n✅ Public mode enabled - users can provide their own API keys`);
});
