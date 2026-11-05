'use strict';

const config = require('../config');

const settings = {
    autoread: false,
    autotyping: false,
    autoonline: false,
    autorecording: false,
    autoreact: false,
    autoreply: false,
    autosticker: false,
    autoview: false,
    autobio: false,
    autolikestatus: false
};

const commands = Object.keys(settings);

module.exports = {
    name: 'auto',
    commands,

    settings,

    async handler(sock, msg, args = [], command) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const number = sender.split('@')[0].split(':')[0];

        const owner = String(config.OWNER_NUMBER || '').replace(/\D/g, '');

        const reply = text =>
            sock.sendMessage(from, { text }, { quoted: msg });

        if (number !== owner) {
            return reply('❌ Owner only command.');
        }

        const action = args[0]?.toLowerCase();

        if (!['on', 'off'].includes(action)) {
            return reply(
                `⚙️ ${command.toUpperCase()}\n\n` +
                `Usage: .${command} on\n` +
                `Usage: .${command} off`
            );
        }

        const enabled = action === 'on';

        try {
            switch (command) {
                case 'autoread':
                    settings.autoread = enabled;
                    break;

                case 'autotyping':
                    settings.autotyping = enabled;
                    break;

                case 'autoonline':
                    settings.autoonline = enabled;

                    await sock.sendPresenceUpdate(
                        enabled ? 'available' : 'unavailable'
                    );
                    break;

                case 'autorecording':
                    settings.autorecording = enabled;
                    break;

                case 'autoreact':
                    settings.autoreact = enabled;
                    break;

                case 'autoreply':
                    settings.autoreply = enabled;
                    break;

                case 'autosticker':
                    settings.autosticker = enabled;
                    break;

                case 'autoview':
                    settings.autoview = enabled;
                    break;

                case 'autobio':
                    settings.autobio = enabled;
                    break;

                case 'autolikestatus':
                    settings.autolikestatus = enabled;
                    break;

                default:
                    return reply('❌ Unknown auto command.');
            }

            return reply(
                `⚙️ AUTO SETTINGS\n\n` +
                `Command: ${command}\n` +
                `Status: ${enabled ? 'ON ✅' : 'OFF ❌'}`
            );

        } catch (error) {
            console.error(`[AUTO PLUGIN] ${command}:`, error);
            return reply(`❌ Error: ${error.message}`);
        }
    }
};
