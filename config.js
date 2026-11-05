require('dotenv').config();

module.exports = {
    BOT_NAME: process.env.BOT_NAME || 'META AI V2',
    OWNER_NAME: process.env.OWNER_NAME || 'SIMON TECH INC',
    OWNER_NUMBER: process.env.OWNER_NUMBER || '234XXXXXXXXXX',

    PREFIX: process.env.PREFIX || '.',
    MODE: process.env.MODE || 'public',

    PORT: process.env.PORT || 3000,

    MENU_PIC: process.env.MENU_PIC || 'https://files.catbox.moe/msvhxd.png',

    SESSION_DIR: process.env.SESSION_DIR || 'sessions',

    VERSION: '2.0.0',
    TOTAL_COMMANDS: 100,

    DEVELOPER: 'SIMON TECH INC'
};
