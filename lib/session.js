const fs = require('fs');
const path = require('path');
const {
    useMultiFileAuthState
} = require('@whiskeysockets/baileys');

const config = require('../config');
const { ensureDir, getSessionPath } = require('./function');

const sessions = new Map();

async function createSession(userId) {
    const sessionPath = getSessionPath(userId);

    ensureDir(sessionPath);

    const { state, saveCreds } =
        await useMultiFileAuthState(sessionPath);

    return {
        state,
        saveCreds
    };
}

function addSession(userId, socket) {
    sessions.set(userId, socket);
}

function getSession(userId) {
    return sessions.get(userId);
}

function removeSession(userId) {
    const socket = sessions.get(userId);

    if (socket) {
        socket.end(undefined);
        sessions.delete(userId);
    }
}

function getAllSessions() {
    return sessions;
}

function hasSession(userId) {
    return sessions.has(userId);
}

module.exports = {
    createSession,
    addSession,
    getSession,
    removeSession,
    getAllSessions,
    hasSession
};
