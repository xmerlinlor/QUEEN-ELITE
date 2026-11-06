require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const pino = require('pino');

const {
    default: makeWASocket,
    DisconnectReason,
    Browsers
} = require('@whiskeysockets/baileys');

const config = require('./config');

const {
    createSession,
    addSession,
    getSession,
    removeSession,
    getAllSessions,
    getSessionCount,
    withSessionLock
} = require('./lib/session');

const {
    ensureDir,
    getSessionPath
} = require('./lib/function');

const {
    updateUser
} = require('./lib/database');

const handler = require('./lib/handler');

const app = express();

app.use(express.json({ limit: '20kb' }));

// ================================
// SERVER CONFIGURATION
// ================================

const PORT = config.PORT;
const SESSION_DIR = path.resolve(
    process.cwd(),
    config.SESSION_DIR
);

ensureDir(SESSION_DIR);

const logger = pino({
    level: 'silent'
});

const pairingCodes = new Map();
const reconnecting = new Set();
const requestLimits = new Map();

let server;

// ================================
// API SECURITY
// ================================

function authorize(req, res, next) {
    const apiKey = process.env.PAIR_API_KEY;

    if (apiKey && req.headers['x-api-key'] !== apiKey) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized.'
        });
    }

    next();
}

function rateLimit(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress;
    const now = Date.now();

    const previous = requestLimits.get(ip) || [];
    const recent = previous.filter(t => now - t < 600000);

    if (recent.length >= 5) {
        return res.status(429).json({
            success: false,
            message: 'Too many pairing requests. Try again later.'
        });
    }

    recent.push(now);
    requestLimits.set(ip, recent);

    next();
}

// ================================
// PHONE VALIDATION
// ================================

function normalizePhone(phone) {
    return String(phone || '').replace(/\D/g, '');
}

function validPhone(phone) {
    return /^[1-9]\d{7,14}$/.test(phone);
}

// ================================
// SESSION STATUS
// ================================

function getStatus(phone) {
    const socket = getSession(phone);

    if (!socket) return 'disconnected';

    if (socket.user) return 'connected';

    return 'connecting';
}

// ================================
// START WHATSAPP SESSION
// ================================

async function startSession(phone, options = {}) {
    const userId = normalizePhone(phone);

    if (!validPhone(userId)) {
        throw new Error('Invalid phone number.');
    }

    return withSessionLock(userId, async () => {

        const existing = getSession(userId);

        if (existing) {
            return {
                success: true,
                existing: true,
                status: getStatus(userId),
                pairingCode: pairingCodes.get(userId) || null
            };
        }

        if (
            getSessionCount() >= config.MAX_SESSIONS
        ) {
            throw new Error('Maximum session limit reached.');
        }

        console.log(`Starting session: ${userId}`);

        // CREATE AUTHENTICATION STATE

        const {
            state,
            saveCreds
        } = await createSession(userId);

        // CREATE WHATSAPP SOCKET

        const sock = makeWASocket({
            auth: state,

            logger,

            browser: Browsers.ubuntu('Chrome'),

            printQRInTerminal: false,

            markOnlineOnConnect: false,

            syncFullHistory: false,

            connectTimeoutMs: 60000,

            defaultQueryTimeoutMs: 60000,

            keepAliveIntervalMs: 30000
        });

        addSession(userId, sock);

        // SAVE CREDENTIALS

        sock.ev.on('creds.update', async () => {
            try {
                await saveCreds();
            } catch (error) {
                console.error('Credential save error:', error.message);
            }
        });

        // ================================
        // MESSAGE HANDLER
        // ================================

        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;

            for (const msg of messages) {
                if (!msg.message || msg.key.fromMe) continue;

                try {
                    // ANTI PROTECTION
                    const antiPlugin = require('./plugins/anti');

                    if (typeof antiPlugin.checkMessage === 'function') {
                        await antiPlugin.checkMessage(sock, msg);
                    }

                    // COMMAND HANDLER
                    await handler(sock, msg);

                } catch (error) {
                    console.error(
                        `Message error (${userId}):`,
                        error.message
                    );
                }
            }
        });

        // ================================
        // CONNECTION EVENTS
        // ================================

        sock.ev.on('connection.update', async update => {
            const { connection, lastDisconnect } = update;

            if (connection === 'connecting') {
                console.log(`[${userId}] Connecting...`);
            }

            if (connection === 'open') {
                pairingCodes.delete(userId);

                updateUser(userId, {
                    connected: true,
                    lastSeen: Date.now()
                });

                console.log(`[${userId}] WhatsApp connected!`);
            }

            if (connection === 'close') {
                const statusCode =
                    lastDisconnect?.error?.output?.statusCode;

                const loggedOut =
                    statusCode === DisconnectReason.loggedOut;

                console.log(
                    `[${userId}] Connection closed. Code: ${statusCode}`
                );

                removeSession(userId);

                pairingCodes.delete(userId);

                updateUser(userId, {
                    connected: false,
                    lastSeen: Date.now()
                });

                if (!loggedOut && !reconnecting.has(userId)) {
                    reconnecting.add(userId);

                    setTimeout(async () => {
                        reconnecting.delete(userId);

                        try {
                            await startSession(userId);
                        } catch (error) {
                            console.error(
                                `Reconnect error (${userId}):`,
                                error.message
                            );
                        }
                    }, config.SESSION_RECONNECT_DELAY);
                }
            }
        });

        // ================================
        // PAIRING CODE
        // ================================

        let code = null;

        if (
            options.requestPairing &&
            !state.creds.registered
        ) {
            await new Promise(resolve => setTimeout(resolve, 2000));

            if (!getSession(userId)) {
                throw new Error('Connection closed before pairing.');
            }

            code = await sock.requestPairingCode(userId);

            pairingCodes.set(userId, code);

            console.log(`[${userId}] Pairing code generated.`);
        }

        return {
            success: true,
            existing: false,
            status: getStatus(userId),
            pairingCode: code
        };
    });
}

// ================================
// PAIRING API
// ================================

app.post('/pair', authorize, rateLimit, async (req, res) => {
    try {
        const phone = normalizePhone(req.body.phone);

        if (!validPhone(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Enter a valid international phone number without +.'
            });
        }

        const result = await startSession(phone, {
            requestPairing: true
        });

        if (!result.pairingCode) {
            return res.status(409).json({
                success: false,
                status: result.status,
                message: 'Session already exists or is already registered.'
            });
        }

        return res.json({
            success: true,
            phone,
            pairingCode: result.pairingCode,
            status: result.status,
            message: 'Enter this code in your WhatsApp linked-devices screen.'
        });

    } catch (error) {
        console.error('Pairing error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ================================
// SESSION STATUS API
// ================================

app.get('/status', authorize, (req, res) => {
    const sessions = [];

    for (const [phone] of getAllSessions()) {
        sessions.push({
            phone,
            status: getStatus(phone)
        });
    }

    res.json({
        bot: config.BOT_NAME,
        version: config.VERSION,
        connected: sessions.filter(s => s.status === 'connected').length,
        total: sessions.length,
        sessions
    });
});

// ================================
// LOGOUT API
// ================================

app.post('/logout', authorize, async (req, res) => {
    try {
        const phone = normalizePhone(req.body.phone);

        if (!validPhone(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number.'
            });
        }

        const sock = getSession(phone);

        if (!sock) {
            return res.status(404).json({
                success: false,
                message: 'Session not found.'
            });
        }

        await sock.logout();

        removeSession(phone);

        pairingCodes.delete(phone);

        updateUser(phone, {
            connected: false,
            lastSeen: Date.now()
        });

        const sessionPath = getSessionPath(phone);

        fs.rmSync(sessionPath, {
            recursive: true,
            force: true
        });

        return res.json({
            success: true,
            message: 'WhatsApp session disconnected.'
        });

    } catch (error) {
        console.error('Logout error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Logout failed.'
        });
    }
});

// ================================
// HOME PAGE
// ================================

app.get('/', (req, res) => {
    const indexFile = path.join(
        __dirname,
        'public',
        'index.html'
    );

    if (fs.existsSync(indexFile)) {
        return res.sendFile(indexFile);
    }

    res.send(`
        <h1>${config.BOT_NAME}</h1>
        <p>Multi-Device Server Online</p>
        <p>Version: ${config.VERSION}</p>
    `);
});

// ================================
// HEALTH CHECK
// ================================

app.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'online',
        sessions: getSessionCount(),
        time: new Date().toISOString()
    });
});

// ================================
// RESTORE SAVED SESSIONS
// ================================

async function restoreSessions() {
    if (!fs.existsSync(SESSION_DIR)) return;

    const folders = fs.readdirSync(SESSION_DIR, {
        withFileTypes: true
    });

    for (const folder of folders) {
        if (!folder.isDirectory()) continue;

        const phone = folder.name;

        if (!validPhone(phone)) continue;

        try {
            await startSession(phone);
            console.log(`Restored session: ${phone}`);
        } catch (error) {
            console.error(
                `Restore error (${phone}):`,
                error.message
            );
        }
    }
}

// ================================
// START SERVER
// ================================

async function startServer() {
    server = app.listen(PORT, '0.0.0.0', async () => {
        console.log('================================');
        console.log(` ${config.BOT_NAME}`);
        console.log(' Multi-Device Server');
        console.log('================================');
        console.log(`Port: ${PORT}`);
        console.log(`Version: ${config.VERSION}`);
        console.log(`Mode: ${config.MODE}`);
        console.log('Server: ONLINE');

        if (!process.env.PAIR_API_KEY) {
            console.warn(
                'WARNING: Set PAIR_API_KEY before exposing pairing endpoints publicly.'
            );
        }

        await restoreSessions();
    });
}

process.on('unhandledRejection', error => {
    console.error('Unhandled rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});

startServer();
