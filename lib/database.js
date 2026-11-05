const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '../database');
const DB_FILE = path.join(DB_DIR, 'data.json');

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({
        users: {},
        settings: {
            mode: 'public',
            prefix: '.'
        }
    }, null, 2));
}

function readDB() {
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (error) {
        return {
            users: {},
            settings: {
                mode: 'public',
                prefix: '.'
            }
        };
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function getUser(userId) {
    const db = readDB();

    if (!db.users[userId]) {
        db.users[userId] = {
            registered: true,
            commands: 0,
            joinedAt: Date.now()
        };

        writeDB(db);
    }

    return db.users[userId];
}

function updateUser(userId, updates) {
    const db = readDB();

    db.users[userId] = {
        ...db.users[userId],
        ...updates
    };

    writeDB(db);
    return db.users[userId];
}

function getSettings() {
    return readDB().settings;
}

function updateSettings(updates) {
    const db = readDB();

    db.settings = {
        ...db.settings,
        ...updates
    };

    writeDB(db);
    return db.settings;
}

module.exports = {
    readDB,
    writeDB,
    getUser,
    updateUser,
    getSettings,
    updateSettings
};
