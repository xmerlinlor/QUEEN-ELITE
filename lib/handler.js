
const fs = require('fs');
const path = require('path');

const config = require('../config');

const {
    incrementCommands,
    getSettings
} = require('./database');

const {
    getTime,
    getDate
} = require('./function');

const PLUGIN_DIR = path.join(__dirname, '../plugins');
const plugins = new Map();

function loadPlugins() {
    if (!fs.existsSync(PLUGIN_DIR)) {
        fs.mkdirSync(PLUGIN_DIR, { recursive: true });
    }

    plugins.clear();

    for (const file of fs.readdirSync(PLUGIN_DIR)) {
        if (!file.endsWith('.js')) continue;

        try {
            const filePath = path.join(PLUGIN_DIR, file);

            delete require.cache[require.resolve(filePath)];

            const plugin = require(filePath);

            if (!Array.isArray(plugin.commands) ||
                typeof plugin.handler !== 'function') {
                console.log(`Skipped invalid plugin: ${file}`);
                continue;
            }

            for (const command of plugin.commands) {
                const name = command.toLowerCase();

                if (plugins.has(name)) {
                    console.warn(`Duplicate command skipped: ${name}`);
                    continue;
                }

                plugins.set(name, plugin);
            }

            console.log(`Loaded plugin: ${file}`);

        } catch (error) {
            console.error(`Plugin error (${file}):`, error.message);
        }
    }
}

loadPlugins();

async function handler(sock, msg) {
    try {
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        if (!from) return;

        const sender = msg.key.participant || from;

        const body =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            msg.message.videoMessage?.caption ||
            '';

        if (!body) return;

        const settings = getSettings();
        const prefix = settings.prefix || config.PREFIX;

        if (!body.startsWith(prefix)) return;

        const args = body.slice(prefix.length).trim().split(/\s+/);
        const command = (args.shift() || '').toLowerCase();

        if (!command) return;

        incrementCommands(sender);

        const reply = async message => {
            return sock.sendMessage(from, {
                text: message
            }, { quoted: msg });
        };

        const basicCommands = {
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
                await reply('🤖 META AI V2 WhatsApp Multi-Device Bot');
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
                await reply(`Type ${prefix}menu to see available commands.`);
            },

            menu: async () => {
                const menu = require('./menu');
                const menuText = typeof menu === 'function'
                    ? await menu()
                    : await menu.getMenu();

                if (typeof menuText !== 'string') {
                    throw new Error('Menu must return text.');
                }

                await sock.sendMessage(from, {
                    image: {
                        url: config.MENU_PIC
                    },
                    caption: menuText
                }, {
                    quoted: msg
                });
            }
        };

        if (basicCommands[command]) {
            await basicCommands[command]();
            return;
        }

        const plugin = plugins.get(command);

        if (plugin) {
            await plugin.handler(sock, msg, args, command);
            return;
        }

        await reply(
            `❌ Unknown command: ${command}\nType ${prefix}menu`
        );

    } catch (error) {
        console.error('Handler error:', error);

        try {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Command failed. Check the bot logs.'
            }, { quoted: msg });
        } catch {}
    }
}

handler.loadPlugins = loadPlugins;
handler.plugins = plugins;

module.exports = handler;
