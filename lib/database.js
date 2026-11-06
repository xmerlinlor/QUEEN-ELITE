const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '../database');
const DB_FILE = path.join(DB_DIR, 'data.json');

const DEFAULT_DB = {
    users: {},
    settings: {
        mode: 'public',
        prefix: '.'
    }
};

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(
        DB_FILE,
        JSON.stringify(DEFAULT_DB, null, 2)
    );
}

function readDB() {
    try {
        const data = JSON.parse(
            fs.readFileSync(DB_FILE, 'utf8')
        );

        return {
            users: data.users || {},
            settings: {
                ...DEFAULT_DB.settings,
                ...(data.settings || {})
            }
        };
    } catch (error) {
        console.error('Database read error:', error.message);
        return structuredClone(DEFAULT_DB);
    }
}

function writeDB(data) {
    const tempFile = `${DB_FILE}.tmp`;

    fs.writeFileSync(
        tempFile,
        JSON.stringify(data, null, 2)
    );

    fs.renameSync(tempFile, DB_FILE);
}

function getUser(userId) {
    const id = String(userId);

    const db = readDB();

    if (!db.users[id]) {
        db.users[id] = {
            id,
            registered: true,
            connected: false,
            commands: 0,
            joinedAt: Date.now(),
            lastSeen: null
        };

        writeDB(db);
    }

    return db.users[id];
}

function updateUser(userId, updates) {
    const id = String(userId);
    const db = readDB();

    db.users[id] = {
        ...(db.users[id] || {
            id,
            registered: true,
            connected: false,
            commands: 0,
            joinedAt: Date.now(),
            lastSeen: null
        }),
        ...updates,
        id
    };

    writeDB(db);

    return db.users[id];
}

function deleteUser(userId) {
    const db = readDB();
    const id = String(userId);

    if (!db.users[id]) return false;

    delete db.users[id];
    writeDB(db);

    return true;
}

function getAllUsers() {
    return readDB().users;
}

function getUserCount() {
    return Object.keys(getAllUsers()).length;
}

function incrementCommands(userId) {
    const user = getUser(userId);

    return updateUser(userId, {
        commands: user.commands + 1,
        lastSeen: Date.now()
    });
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
    deleteUser,
    getAllUsers,
    getUserCount,
    incrementCommands,
    getSettings,
    updateSettings
};
