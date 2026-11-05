const fs = require('fs');
const path = require('path');
const axios = require('axios');

const config = require('../config');

const sleep = (ms) =>
    new Promise(resolve => setTimeout(resolve, ms));

const getTime = () =>
    new Date().toLocaleTimeString('en-NG');

const getDate = () =>
    new Date().toLocaleDateString('en-NG');

const formatBytes = (bytes) => {
    if (!bytes) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));

    return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
};

const isUrl = (text) =>
    /^https?:\/\/[^\s]+$/i.test(text);

const getJson = async (url) => {
    const response = await axios.get(url, {
        timeout: 15000
    });

    return response.data;
};

const ensureDir = (directory) => {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
};

const getSessionPath = (userId) => {
    const safeId = String(userId).replace(/[^a-zA-Z0-9_-]/g, '');

    return path.join(
        process.cwd(),
        config.SESSION_DIR,
        safeId
    );
};

const getUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${days}d ${hours}h ${minutes}m ${secs}s`;
};

module.exports = {
    sleep,
    getTime,
    getDate,
    formatBytes,
    isUrl,
    getJson,
    ensureDir,
    getSessionPath,
    getUptime
};
