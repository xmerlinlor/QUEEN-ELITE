const config = require('../config');
const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '../database');
const DB_FILE = path.join(DB_DIR, 'anti-settings.json');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '{}');

let settings = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const activity = new Map();

function save() {
    fs.writeFileSync(DB_FILE, JSON.stringify(settings, null, 2));
}

function getGroup(jid) {
    if (!settings[jid]) {
        settings[jid] = {
            antilink: false,
            antispam: false,
            antiflood: false,
            antitag: false,
            antibadword: false,
            badwords: []
        };
        save();
    }
    return settings[jid];
}

function getNumber(jid = '') {
    return jid.split('@')[0].split(':')[0];
}

function isOwner(jid) {
    return getNumber(jid) === String(config.OWNER_NUMBER || '').replace(/\D/g, '');
}

async function getAdmins(sock, jid) {
    const metadata = await sock.groupMetadata(jid);
    return metadata.participants
        .filter(p => p.admin)
        .map(p => p.id);
}

function containsLink(text) {
    return /(https?:\/\/|www\.|chat\.whatsapp\.com\/|t\.me\/|discord\.gg\/)/i.test(text);
}

function isEnabled(value) {
    return ['on', 'enable', 'enabled'].includes(value);
}

module.exports = {
    name: 'anti',

    commands: [
        'antilink',
        'antispam',
        'antiflood',
        'antitag',
        'antibadword',
        'badwordadd',
        'badwordremove'
    ],

    async handler(sock, msg, args, command) {
        const jid = msg.key.remoteJid;
        const sender = msg.key.participant || jid;

        if (!jid.endsWith('@g.us')) {
            return sock.sendMessage(jid, {
                text: '❌ Group commands only.'
            }, { quoted: msg });
        }

        const admins = await getAdmins(sock, jid);
        const isAdmin = admins.includes(sender) || isOwner(sender);

        if (!isAdmin) {
            return sock.sendMessage(jid, {
                text: '❌ Only group admins can change anti settings.'
            }, { quoted: msg });
        }

        const group = getGroup(jid);
        const value = String(args[0] || '').toLowerCase();

        const features = [
            'antilink',
            'antispam',
            'antiflood',
            'antitag',
            'antibadword'
        ];

        if (features.includes(command)) {
            if (!['on', 'off', 'enable', 'disable', 'enabled', 'disabled'].includes(value)) {
                return sock.sendMessage(jid, {
                    text: `Usage: .${command} on/off`
                }, { quoted: msg });
            }

            group[command] = isEnabled(value);
            save();

            return sock.sendMessage(jid, {
                text: `✅ ${command} ${group[command] ? 'enabled' : 'disabled'}.`
            }, { quoted: msg });
        }

        if (command === 'badwordadd') {
            const word = args.join(' ').trim().toLowerCase();
            if (!word) return sock.sendMessage(jid, {
                text: 'Usage: .badwordadd word'
            }, { quoted: msg });

            if (!group.badwords.includes(word)) group.badwords.push(word);
            save();

            return sock.sendMessage(jid, {
                text: `✅ Added: ${word}`
            }, { quoted: msg });
        }

        if (command === 'badwordremove') {
            const word = args.join(' ').trim().toLowerCase();
            if (!word) return sock.sendMessage(jid, {
                text: 'Usage: .badwordremove word'
            }, { quoted: msg });

            group.badwords = group.badwords.filter(w => w !== word);
            save();

            return sock.sendMessage(jid, {
                text: `✅ Removed: ${word}`
            }, { quoted: msg });
        }
    },

    async checkMessage(sock, msg) {
        const jid = msg.key.remoteJid;
        if (!jid || !jid.endsWith('@g.us')) return;
        if (msg.key.fromMe) return;

        const sender = msg.key.participant;
        if (!sender) return;

        const group = getGroup(jid);
        const text = (
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            ''
        );

        if (!text) return;

        const admins = await getAdmins(sock, jid);
        if (admins.includes(sender)) return;

        const now = Date.now();
        const key = `${jid}:${sender}`;
        const previous = activity.get(key) || [];

        const recent = previous.filter(time => now - time < 5000);
        recent.push(now);
        activity.set(key, recent);

        let reason = '';

        if (group.antilink && containsLink(text)) {
            reason = 'Links are not allowed in this group.';
        } else if (group.antiflood && recent.length >= 5) {
            reason = 'Please stop flooding the group.';
        } else if (group.antispam && recent.length >= 4) {
            reason = 'Please avoid repeated messages.';
        } else if (
            group.antitag &&
            (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []).length >= 5
        ) {
            reason = 'Mass tagging is not allowed.';
        } else if (
            group.antibadword &&
            group.badwords.some(word => text.toLowerCase().includes(word))
        ) {
            reason = 'Please avoid prohibited words.';
        }

        if (!reason) return;

        try {
            await sock.sendMessage(jid, {
                delete: msg.key
            });

            await sock.sendMessage(jid, {
                text: `⚠️ @${getNumber(sender)}: ${reason}`,
                mentions: [sender]
            });
        } catch (error) {
            console.error('Anti protection error:', error.message);
        }
    }
};
