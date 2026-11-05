require('dotenv').config();

module.exports = {
    // BOT INFORMATION
    BOT_NAME: process.env.BOT_NAME || 'META AI V2',
    OWNER_NAME: process.env.OWNER_NAME || 'SIMON TECH INC',
    OWNER_NUMBER: process.env.OWNER_NUMBER || '234XXXXXXXXXX',

    // BOT SETTINGS
    PREFIX: process.env.PREFIX || '.',
    MODE: process.env.MODE || 'public',

    // SERVER
    PORT: Number(process.env.PORT) || 3000,

    // MENU
    MENU_PIC: process.env.MENU_PIC || 'https://files.catbox.moe/msvhxd.png',

    // MULTI-USER SESSIONS
    SESSION_DIR: process.env.SESSION_DIR || 'sessions',
    MULTI_DEVICE: true,
    PAIRING_ENABLED: true,
    AUTO_RECONNECT: true,

    // SESSION MANAGEMENT
    MAX_SESSIONS: Number(process.env.MAX_SESSIONS) || 100,
    SESSION_RECONNECT_DELAY: 5000,

    // BOT DETAILS
    VERSION: '2.0.0',
    TOTAL_COMMANDS: 150,
    DEVELOPER: 'SIMON TECH INC',
    DESCRIPTION: 'META AI V2 WhatsApp Multi-Device Bot',

    // REGION
    TIMEZONE: 'Africa/Lagos'
};
