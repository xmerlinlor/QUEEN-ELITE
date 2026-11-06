const fs = require('fs');
const path = require('path');
const axios = require('axios');

const config = require('../config');

const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

const getTime = () =>
    new Date().toLocaleTimeString('en-NG', {
        timeZone: config.TIMEZONE
    });

const getDate = () =>
    new Date().toLocaleDateString('en-NG', {
        timeZone: config.TIMEZONE
    });

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        units.length - 1
    );

    return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
}

function isUrl(text) {
    try {
        const url = new URL(text);

        return ['http:', 'https:'].includes(url.protocol);
    } catch {
        return false;
    }
}

async function getJson(url) {
    if (!isUrl(url)) {
        throw new Error('Invalid URL.');
    }

    const response = await axios.get(url, {
        timeout: 15000,
        maxContentLength: 5 * 1024 * 1024,
        maxBodyLength: 5 * 1024 * 1024,
        headers: {
            Accept: 'application/json'
        }
    });

    return response.data;
}

function ensureDir(directory) {
    fs.mkdirSync(directory, {
        recursive: true
    });
}

function getSessionPath(userId) {
    const safeId = String(userId).replace(/\D/g, '');

    if (!safeId) {
        throw new Error('Invalid session user ID.');
    }

    const baseDir = path.resolve(
        process.cwd(),
        config.SESSION_DIR
    );

    const sessionDir = path.resolve(baseDir, safeId);

    if (!sessionDir.startsWith(baseDir + path.sep)) {
        throw new Error('Invalid session directory.');
    }

    return sessionDir;
}

function getUptime(seconds) {
    seconds = Math.max(0, Math.floor(seconds || 0));

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

function getRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatNumber(number) {
    return Number(number || 0).toLocaleString('en-NG');
}

module.exports = {
    sleep,
    getTime,
    getDate,
    formatBytes,
    isUrl,
    getJson,
    ensureDir,
    getSessionPath,
    getUptime,
    getRandomNumber,
    formatNumber
};
