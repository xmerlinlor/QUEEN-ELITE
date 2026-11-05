const config = require('../config');

function getNumber(jid = '') {
    return jid.split('@')[0].split(':')[0];
}

function isOwner(jid) {
    return getNumber(jid) === String(config.OWNER_NUMBER || '').replace(/\D/g, '');
}

async function getGroup(sock, jid) {
    return sock.groupMetadata(jid);
}

module.exports = {
    name: 'group',

    commands: [
        'groupinfo',
        'grouplink',
        'setname',
        'setdesc',
        'open',
        'close',
        'tagall',
        'hidetag',
        'listmembers',
        'admins'
    ],

    async handler(sock, msg, args, command) {
        const jid = msg.key.remoteJid;
        const sender = msg.key.participant || jid;

        if (!jid.endsWith('@g.us')) {
            return sock.sendMessage(jid, {
                text: '❌ This command works in groups only.'
            }, { quoted: msg });
        }

        try {
            const metadata = await getGroup(sock, jid);
            const participants = metadata.participants || [];

            const senderIsAdmin = participants.some(
                p => p.id === sender && p.admin
            );

            const botIsAdmin = participants.some(
                p => p.id === sock.user.id && p.admin
            );

            const adminCommands = [
                'grouplink', 'setname', 'setdesc',
                'open', 'close', 'tagall', 'hidetag'
            ];

            if (adminCommands.includes(command) &&
                !senderIsAdmin && !isOwner(sender)) {
                return sock.sendMessage(jid, {
                    text: '❌ Only group admins can use this command.'
                }, { quoted: msg });
            }

            if (command === 'groupinfo') {
                const admins = participants.filter(p => p.admin);

                return sock.sendMessage(jid, {
                    text:
`╭━━━〔 GROUP INFO 〕━━━
┃ Name: ${metadata.subject}
┃ Members: ${participants.length}
┃ Admins: ${admins.length}
┃ Created: ${metadata.creation || 'Unknown'}
┃ Description: ${metadata.desc || 'None'}
╰━━━━━━━━━━━━━━━━━━`,
                }, { quoted: msg });
            }

            if (command === 'grouplink') {
                if (!botIsAdmin) {
                    return sock.sendMessage(jid, {
                        text: '❌ Bot must be an admin.'
                    }, { quoted: msg });
                }

                const code = await sock.groupInviteCode(jid);

                return sock.sendMessage(jid, {
                    text: `🔗 Group link:\nhttps://chat.whatsapp.com/${code}`
                }, { quoted: msg });
            }

            if (command === 'setname') {
                const name = args.join(' ').trim();

                if (!name) {
                    return sock.sendMessage(jid, {
                        text: 'Usage: .setname New Group Name'
                    }, { quoted: msg });
                }

                await sock.groupUpdateSubject(jid, name);

                return sock.sendMessage(jid, {
                    text: '✅ Group name updated.'
                }, { quoted: msg });
            }

            if (command === 'setdesc') {
                const desc = args.join(' ').trim();

                if (!desc) {
                    return sock.sendMessage(jid, {
                        text: 'Usage: .setdesc New description'
                    }, { quoted: msg });
                }

                await sock.groupUpdateDescription(jid, desc);

                return sock.sendMessage(jid, {
                    text: '✅ Group description updated.'
                }, { quoted: msg });
            }

            if (command === 'open' || command === 'close') {
                if (!botIsAdmin) {
                    return sock.sendMessage(jid, {
                        text: '❌ Bot must be an admin.'
                    }, { quoted: msg });
                }

                await sock.groupSettingUpdate(
                    jid,
                    command === 'close' ? 'announcement' : 'not_announcement'
                );

                return sock.sendMessage(jid, {
                    text: command === 'close'
                        ? '🔒 Only admins can send messages.'
                        : '🔓 Everyone can send messages.'
                }, { quoted: msg });
            }

            if (command === 'tagall' || command === 'hidetag') {
                const text = args.join(' ') || 'Attention everyone!';
                const mentions = participants.map(p => p.id);

                return sock.sendMessage(jid, {
                    text: command === 'tagall'
                        ? `📢 ${text}\n\n${mentions.map(n => `@${getNumber(n)}`).join(' ')}`
                        : text,
                    mentions
                }, { quoted: msg });
            }

            if (command === 'listmembers') {
                const members = participants.map(
                    (p, i) => `${i + 1}. @${getNumber(p.id)}`
                );

                return sock.sendMessage(jid, {
                    text: `👥 GROUP MEMBERS (${participants.length})\n\n${members.join('\n')}`,
                    mentions: participants.map(p => p.id)
                }, { quoted: msg });
            }

            if (command === 'admins') {
                const admins = participants.filter(p => p.admin);

                return sock.sendMessage(jid, {
                    text: `👑 GROUP ADMINS (${admins.length})\n\n${admins.map((p, i) => `${i + 1}. @${getNumber(p.id)}`).join('\n')}`,
                    mentions: admins.map(p => p.id)
                }, { quoted: msg });
            }

        } catch (error) {
            console.error('Group plugin error:', error);

            return sock.sendMessage(jid, {
                text: `❌ ${command} failed: ${error.message}`
            }, { quoted: msg });
        }
    }
};
