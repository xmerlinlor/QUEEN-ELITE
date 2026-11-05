const fs = require('fs');
const path = require('path');

const {
    useMultiFileAuthState
} = require('@whiskeysockets/baileys');

const config = require('../config');
const {
    ensureDir,
    getSessionPath
} = require('./function');

const sessions = new Map();
const pendingSessions = new Map();

function normalizeUserId(userId) {
    if (!userId) {
        throw new Error('User ID is required.');
    }

    return String(userId)
        .replace(/[^0-9]/g, '');
}

async function createSession(userId) {
    const id = normalizeUserId(userId);

    if (!id) {
        throw new Error('Invalid user ID.');
    }

    const sessionPath = path.resolve(getSessionPath(id));
    const basePath = path.resolve(config.SESSION_DIR);

    if (!sessionPath.startsWith(basePath + path.sep)) {
        throw new Error('Invalid session path.');
    }

    ensureDir(sessionPath);

    const {
        state,
        saveCreds
    } = await useMultiFileAuthState(sessionPath);

    return {
        userId: id,
        sessionPath,
        state,
        saveCreds
    };
}

function addSession(userId, socket) {
    const id = normalizeUserId(userId);

    if (!socket) {
        throw new Error('Socket is required.');
    }

    const existing = sessions.get(id);

    if (existing && existing !== socket) {
        throw new Error(`Session already exists for ${id}.`);
    }

    sessions.set(id, socket);
    return socket;
}

function getSession(userId) {
    return sessions.get(normalizeUserId(userId));
}

function hasSession(userId) {
    return sessions.has(normalizeUserId(userId));
}

function removeSession(userId) {
    const id = normalizeUserId(userId);
    const socket = sessions.get(id);

    if (!socket) return false;

    sessions.delete(id);

    try {
        socket.end(undefined);
    } catch (error) {
        console.error(`Session close error (${id}):`, error.message);
    }

    return true;
}

function getAllSessions() {
    return new Map(sessions);
}

function getSessionCount() {
    return sessions.size;
}

function isCreatingSession(userId) {
    return pendingSessions.has(normalizeUserId(userId));
}

async function withSessionLock(userId, callback) {
    const id = normalizeUserId(userId);

    if (pendingSessions.has(id)) {
        return pendingSessions.get(id);
    }

    const task = Promise.resolve().then(callback);

    pendingSessions.set(id, task);

    try {
        return await task;
    } finally {
        if (pendingSessions.get(id) === task) {
            pendingSessions.delete(id);
        }
    }
}

function getSessionDirectory(userId) {
    return getSessionPath(normalizeUserId(userId));
}

module.exports = {
    createSession,
    addSession,
    getSession,
    removeSession,
    getAllSessions,
    hasSession,
    getSessionCount,
    withSessionLock,
    isCreatingSession,
    getSessionDirectory
};
