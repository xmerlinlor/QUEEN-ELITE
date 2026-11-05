const config = require('../config');
const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '../database');
const WARN_FILE = path.join(DB_DIR, 'warnings.json');
const MUTE_FILE = path.join(DB_DIR, 'muted-groups.json');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(WARN_FILE)) fs.writeFileSync(WARN_FILE, '{}');
if (!fs.existsSync(MUTE_FILE)) fs.writeFileSync(MUTE_FILE, '{}');

let warnings = JSON.parse(fs.readFileSync(WARN_FILE, 'utf8'));
let mutedGroups = JSON.parse(fs.readFileSync(MUTE_FILE, 'utf8'));

function saveWarnings() {
    fs.writeFileSync(WARN_FILE, JSON.stringify(warnings, null, 2));
}

function saveMutes() {
    fs.writeFileSync(MUTE_FILE, JSON.stringify(mutedGroups, null, 2));
}

function numberOf(jid = '') {
    return jid.split('@')[0].split(':')[0];
}

function isOwner(jid) {
    return numberOf(jid) === String(config.OWNER_NUMBER || '').replace(/\D/g, '');
}

function getTarget(msg, args) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;

    if (mentioned.length) return mentioned[0];
    if (quoted) return quoted;

    const number = String(args[0] || '').replace(/\D/g, '');
    return number ? `${number}@s.whatsapp.net` : null;
}

async function groupInfo(sock, jid) {
    return sock.groupMetadata(jid);
}

module.exports = {
    name: 'moderator',

    commands: [
        'kick', 'add', 'promote', 'demote',
        'warn', 'warnings', 'resetwarn',
        'mute', 'unmute', 'delete'
    ],

    async handler(sock, msg, args, command) {
        const jid = msg.key.remoteJid;
        const sender = msg.key.participant || jid;

        if (!jid.endsWith('@g.us')) {
            return sock.sendMessage(jid, {
                text: '❌ Group commands only.'
            }, { quoted: msg });
        }

        try {
            const metadata = await groupInfo(sock, jid);
            const participants = metadata.participants;

            const senderIsAdmin = participants.some(
                p => p.id === sender && p.admin
            );

            const botIsAdmin = participants.some(
                p => p.id === sock.user.id && p.admin
            );

            if (!senderIsAdmin && !isOwner(sender)) {
                return sock.sendMessage(jid, {
                    text: '❌ Only group admins can use this command.'
                }, { quoted: msg });
            }

            if (command === 'delete') {
                const quoted = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
                const participant = msg.message?.extendedTextMessage?.contextInfo?.participant;

                if (!quoted || !participant) {
                    return sock.sendMessage(jid, {
                        text: 'Reply to a message with .delete'
                    }, { quoted: msg });
                }

                if (!botIsAdmin) {
                    return sock.sendMessage(jid, {
                        text: '❌ The bot must be an admin to delete messages.'
                    }, { quoted: msg });
                }

                return sock.sendMessage(jid, {
                    delete: {
                        remoteJid: jid,
                        fromMe: false,
                        id: quoted,
                        participant
                    }
                });
            }

            if (command === 'mute' || command === 'unmute') {
                if (!botIsAdmin) {
                    return sock.sendMessage(jid, {
                        text: '❌ The bot must be an admin.'
                    }, { quoted: msg });
                }

                const announcement = command === 'mute';
                await sock.groupSettingUpdate(
                    jid,
                    announcement ? 'announcement' : 'not_announcement'
                );

                mutedGroups[jid] = announcement;
                saveMutes();

                return sock.sendMessage(jid, {
                    text: announcement
                        ? '🔇 Group muted. Only admins can send messages.'
                        : '🔊 Group unmuted. Everyone can send messages.'
                }, { quoted: msg });
            }

            const target = getTarget(msg, args);

            if (!target) {
                return sock.sendMessage(jid, {
                    text: '❌ Mention, reply to, or provide a member number.'
                }, { quoted: msg });
            }

            if (command === 'warn') {
                warnings[jid] ??= {};
                warnings[jid][target] = (warnings[jid][target] || 0) + 1;
                saveWarnings();

                return sock.sendMessage(jid, {
                    text: `⚠️ @${numberOf(target)} has ${warnings[jid][target]} warning(s).`,
                    mentions: [target]
                }, { quoted: msg });
            }

            if (command === 'warnings') {
                const count = warnings[jid]?.[target] || 0;

                return sock.sendMessage(jid, {
                    text: `⚠️ @${numberOf(target)} has ${count} warning(s).`,
                    mentions: [target]
                }, { quoted: msg });
            }

            if (command === 'resetwarn') {
                if (warnings[jid]) delete warnings[jid][target];
                saveWarnings();

                return sock.sendMessage(jid, {
                    text: `✅ Warnings reset for @${numberOf(target)}.`,
                    mentions: [target]
                }, { quoted: msg });
            }

            if (!botIsAdmin) {
                return sock.sendMessage(jid, {
                    text: '❌ The bot must be an admin to manage members.'
                }, { quoted: msg });
            }

            if (command === 'kick') {
                await sock.groupParticipantsUpdate(jid, [target], 'remove');
            } else if (command === 'add') {
                await sock.groupParticipantsUpdate(jid, [target], 'add');
            } else if (command === 'promote') {
                await sock.groupParticipantsUpdate(jid, [target], 'promote');
            } else if (command === 'demote') {
                await sock.groupParticipantsUpdate(jid, [target], 'demote');
            } else {
                return;
            }

            return sock.sendMessage(jid, {
                text: `✅ ${command} completed for @${numberOf(target)}.`,
                mentions: [target]
            }, { quoted: msg });

        } catch (error) {
            console.error('Moderator error:', error);

            return sock.sendMessage(jid, {
                text: `❌ ${command} failed: ${error.message}`
            }, { quoted: msg });
        }
    }
};
