'use strict';

const config = require('../config');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const execFileAsync = promisify(execFile);

const DATA_DIR = path.join(__dirname, '../database');
const SETTINGS_FILE = path.join(DATA_DIR, 'owner-settings.json');
const BANNED_FILE = path.join(DATA_DIR, 'banned-users.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

function readJSON(file, fallback) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return fallback;
    }
}

function writeJSON(file, data) {
    const temp = `${file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data, null, 2));
    fs.renameSync(temp, file);
}

const settings = readJSON(SETTINGS_FILE, {
    mode: 'public',
    prefix: config.PREFIX || '.',
    botName: config.BOT_NAME || 'META AI V2'
});

const bannedUsers = readJSON(BANNED_FILE, []);

function normalizeNumber(value = '') {
    return String(value)
        .split('@')[0]
        .split(':')[0]
        .replace(/\D/g, '');
}

function isOwner(sender) {
    const owner = normalizeNumber(config.OWNER_NUMBER);
    return owner && normalizeNumber(sender) === owner;
}

function isBanned(jid) {
    const number = normalizeNumber(jid);
    return bannedUsers.includes(number);
}

function saveSettings() {
    writeJSON(SETTINGS_FILE, settings);
}

function saveBans() {
    writeJSON(BANNED_FILE, bannedUsers);
}

function updateEnv(key, value) {
    const envFile = path.join(__dirname, '../.env');

    let content = fs.existsSync(envFile)
        ? fs.readFileSync(envFile, 'utf8')
        : '';

    const escaped = String(value).replace(/\r?\n/g, ' ');

    const regex = new RegExp(`^${key}=.*$`, 'm');

    if (regex.test(content)) {
        content = content.replace(regex, `${key}=${escaped}`);
    } else {
        content += `\n${key}=${escaped}\n`;
    }

    fs.writeFileSync(envFile, content);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    name: 'owner',

    commands: [
        'owner', 'botinfo', 'runtime', 'restart', 'shutdown',
        'broadcast', 'setprefix', 'setname', 'setbio', 'setpp',
        'join', 'leave', 'block', 'unblock', 'ban',
        'unban', 'public', 'private', 'update', 'menu'
    ],

    isBanned,

    async handler(sock, msg, args = [], command) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;

        const reply = async text => {
            return sock.sendMessage(
                from,
                { text },
                { quoted: msg }
            );
        };

        if (!isOwner(sender)) {
            return reply('❌ This command is restricted to the bot owner.');
        }

        try {
            switch (command) {

                case 'owner': {
                    return reply(
                        `👑 OWNER INFORMATION\n\n` +
                        `Name: ${config.OWNER_NAME}\n` +
                        `Developer: SIMON TECH INC`
                    );
                }

                case 'botinfo': {
                    return reply(
                        `🤖 META AI V2\n\n` +
                        `Owner: ${config.OWNER_NAME}\n` +
                        `Prefix: ${settings.prefix}\n` +
                        `Version: 2.0.0\n` +
                        `Platform: Node.js\n` +
                        `Mode: ${settings.mode.toUpperCase()}`
                    );
                }

                case 'runtime': {
                    const seconds = Math.floor(process.uptime());
                    const days = Math.floor(seconds / 86400);
                    const hours = Math.floor((seconds % 86400) / 3600);
                    const minutes = Math.floor((seconds % 3600) / 60);
                    const secs = seconds % 60;

                    return reply(
                        `⏱️ BOT RUNTIME\n\n` +
                        `${days}d ${hours}h ${minutes}m ${secs}s`
                    );
                }

                case 'restart': {
                    await reply('♻️ Restarting META AI V2...');
                    setTimeout(() => process.exit(0), 1000);
                    return;
                }

                case 'shutdown': {
                    await reply('🛑 META AI V2 is shutting down.');
                    setTimeout(() => process.exit(0), 1000);
                    return;
                }

                case 'broadcast': {
                    const text = args.join(' ').trim();

                    if (!text) {
                        return reply('Usage: .broadcast Your announcement');
                    }

                    const groups = await sock.groupFetchAllParticipating();
                    const groupIds = Object.keys(groups);

                    if (!groupIds.length) {
                        return reply('No joined groups were found.');
                    }

                    let sent = 0;
                    let failed = 0;

                    for (const jid of groupIds) {
                        try {
                            await sock.sendMessage(jid, {
                                text: `📢 BOT ANNOUNCEMENT\n\n${text}`
                            });

                            sent++;
                            await delay(1200);
                        } catch {
                            failed++;
                        }
                    }

                    return reply(
                        `📢 BROADCAST FINISHED\n\n` +
                        `Successful: ${sent}\n` +
                        `Failed: ${failed}`
                    );
                }

                case 'setprefix': {
                    const prefix = args[0];

                    if (!prefix || prefix.length > 3) {
                        return reply('Usage: .setprefix !');
                    }

                    settings.prefix = prefix;
                    config.PREFIX = prefix;

                    saveSettings();
                    updateEnv('PREFIX', prefix);

                    return reply(`✅ Prefix changed to: ${prefix}`);
                }

                case 'setname': {
                    const name = args.join(' ').trim();

                    if (!name) {
                        return reply('Usage: .setname META AI V2');
                    }

                    await sock.updateProfileName(name);

                    settings.botName = name;
                    config.BOT_NAME = name;

                    saveSettings();
                    updateEnv('BOT_NAME', name);

                    return reply(`✅ Bot name changed to: ${name}`);
                }

                case 'setbio': {
                    const bio = args.join(' ').trim();

                    if (!bio) {
                        return reply('Usage: .setbio Your new bio');
                    }

                    await sock.updateProfileStatus(bio);

                    return reply('✅ WhatsApp profile bio updated.');
                }

                case 'setpp': {
                    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

                    if (!quoted) {
                        return reply('Reply to an image with .setpp');
                    }

                    const imageMessage =
                        quoted.imageMessage ||
                        quoted.viewOnceMessage?.message?.imageMessage ||
                        quoted.viewOnceMessageV2?.message?.imageMessage;

                    if (!imageMessage) {
                        return reply('The replied message must contain an image.');
                    }

                    const buffer = await downloadMediaMessage(
                        {
                            key: {
                                remoteJid: from,
                                id: msg.message.extendedTextMessage.contextInfo.stanzaId,
                                participant: msg.message.extendedTextMessage.contextInfo.participant
                            },
                            message: quoted
                        },
                        'buffer',
                        {}
                    );

                    await sock.updateProfilePicture(sock.user.id, buffer);

                    return reply('✅ WhatsApp profile picture updated.');
                }

                case 'join': {
                    const link = args[0];

                    const match = link?.match(
                        /chat\.whatsapp\.com\/([0-9A-Za-z]+)/i
                    );

                    if (!match) {
                        return reply('Usage: .join https://chat.whatsapp.com/INVITECODE');
                    }

                    const result = await sock.groupAcceptInvite(match[1]);

                    return reply(`✅ Joined group successfully.\n${result}`);
                }

                case 'leave': {
                    if (!from.endsWith('@g.us')) {
                        return reply('Use .leave inside a group.');
                    }

                    await reply('👋 Leaving this group...');
                    return sock.groupLeave(from);
                }

                case 'block':
                case 'unblock': {
                    const number = normalizeNumber(args[0]);

                    if (!number || number.length < 7) {
                        return reply(`Usage: .${command} 234XXXXXXXXX`);
                    }

                    const jid = `${number}@s.whatsapp.net`;

                    await sock.updateBlockStatus(
                        jid,
                        command === 'block' ? 'block' : 'unblock'
                    );

                    return reply(
                        command === 'block'
                            ? `✅ ${number} blocked.`
                            : `✅ ${number} unblocked.`
                    );
                }

                case 'ban': {
                    const number = normalizeNumber(args[0]);

                    if (!number || number.length < 7) {
                        return reply('Usage: .ban 234XXXXXXXXX');
                    }

                    if (number === normalizeNumber(config.OWNER_NUMBER)) {
                        return reply('❌ You cannot ban the bot owner.');
                    }

                    if (bannedUsers.includes(number)) {
                        return reply('This user is already banned.');
                    }

                    bannedUsers.push(number);
                    saveBans();

                    return reply(`🚫 ${number} has been banned from using bot commands.`);
                }

                case 'unban': {
                    const number = normalizeNumber(args[0]);

                    if (!number) {
                        return reply('Usage: .unban 234XXXXXXXXX');
                    }

                    const index = bannedUsers.indexOf(number);

                    if (index === -1) {
                        return reply('This user is not banned.');
                    }

                    bannedUsers.splice(index, 1);
                    saveBans();

                    return reply(`✅ ${number} has been unbanned.`);
                }

                case 'public':
                case 'private': {
                    settings.mode = command;
                    config.MODE = command;

                    saveSettings();
                    updateEnv('MODE', command);

                    return reply(
                        command === 'public'
                            ? '🌍 META AI V2 is now in PUBLIC mode.'
                            : '🔒 META AI V2 is now in PRIVATE mode.'
                    );
                }

                case 'update': {
                    await reply('🔄 Checking Git repository for updates...');

                    const { stdout } = await execFileAsync(
                        'git',
                        ['pull', '--ff-only'],
                        {
                            cwd: path.join(__dirname, '..'),
                            timeout: 60000
                        }
                    );

                    await reply(
                        `✅ Git update completed.\n\n${stdout || 'Already up to date.'}\n\nRestarting...`
                    );

                    setTimeout(() => process.exit(0), 1500);
                    return;
                }

                case 'menu': {
                    const menu = require('../lib/menu');
                    return reply(menu());
                }

                default:
                    return reply('❌ Unknown owner command.');
            }

        } catch (error) {
            console.error(`[OWNER PLUGIN: ${command}]`, error);

            return reply(
                `❌ Command failed: ${error.message || 'Unknown error'}`
            );
        }
    }
};
