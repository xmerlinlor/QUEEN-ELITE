const config = require('../config');
const { getUser, getSettings } = require('./database');
const { getTime, getDate } = require('./function');

async function handler(sock, msg) {
    try {
        if (!msg.message) return;
        if (msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        if (!from) return;

        const sender = msg.key.participant || from;

        const body =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            msg.message.videoMessage?.caption ||
            '';

        const settings = getSettings();
        const prefix = settings.prefix || config.PREFIX;

        if (!body.startsWith(prefix)) return;

        const args = body.slice(prefix.length).trim().split(/\s+/);
        const command = (args.shift() || '').toLowerCase();
        const text = args.join(' ');

        if (!command) return;

        const user = getUser(sender);

        user.commands = (user.commands || 0) + 1;

        const reply = async (message) => {
            return sock.sendMessage(from, {
                text: message
            }, { quoted: msg });
        };

        const commands = {
            ping: async () => {
                await reply('🚀 META AI V2 is online!');
            },

            alive: async () => {
                await reply(
                    `╭━━━〔 META AI V2 〕━━━╮\n` +
                    `│ Status: Online 🟢\n` +
                    `│ Time: ${getTime()}\n` +
                    `│ Date: ${getDate()}\n` +
                    `╰━━━━━━━━━━━━━━━━━━╯`
                );
            },

            bot: async () => {
                await reply('🤖 META AI V2 WhatsApp Bot');
            },

            owner: async () => {
                await reply(
                    `👑 Developer: ${config.OWNER_NAME}\n` +
                    `📞 Owner: ${config.OWNER_NUMBER}`
                );
            },

            prefix: async () => {
                await reply(`Current prefix: ${prefix}`);
            },

            time: async () => {
                await reply(`🕒 ${getTime()}`);
            },

            date: async () => {
                await reply(`📅 ${getDate()}`);
            },

            help: async () => {
                await reply(
                    `╭━━━〔 META AI V2 〕━━━╮\n` +
                    `│ .ping\n` +
                    `│ .alive\n` +
                    `│ .bot\n` +
                    `│ .owner\n` +
                    `│ .prefix\n` +
                    `│ .time\n` +
                    `│ .date\n` +
                    `│ .menu\n` +
                    `╰━━━━━━━━━━━━━━━━━━╯`
                );
            },

            menu: async () => {
                await reply(
                    `╭━━━〔 META AI V2 〕━━━╮\n` +
                    `│ PREFIX: ${prefix}\n` +
                    `│ DEVELOPER: ${config.OWNER_NAME}\n` +
                    `│ TOTAL CMDS: 100\n` +
                    `│\n` +
                    `│ .ping\n` +
                    `│ .alive\n` +
                    `│ .owner\n` +
                    `│ .help\n` +
                    `│ .time\n` +
                    `│ .date\n` +
                    `╰━━━━━━━━━━━━━━━━━━╯`
                );
            }
        };

        if (commands[command]) {
            await commands[command]();
        } else {
            await reply(`❌ Unknown command: ${command}\nType ${prefix}menu`);
        }

    } catch (error) {
        console.error('Handler error:', error);
    }
}

module.exports = handler;
