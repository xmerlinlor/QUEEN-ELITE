const sharp = require('sharp');
const {
    downloadMediaMessage
} = require('@whiskeysockets/baileys');

module.exports = {
    name: 'sticker',
    commands: ['sticker', 's', 'toimg', 'take', 'smeme'],

    async handler(sock, msg, args, command) {
        const jid = msg.key.remoteJid;
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        const message = quoted
            ? { key: msg.message.extendedTextMessage.contextInfo.stanzaId, message: quoted }
            : msg;

        const content = message.message || {};
        const image = content.imageMessage;
        const video = content.videoMessage;

        try {
            if (command === 'toimg') {
                if (!image) {
                    return sock.sendMessage(jid, {
                        text: 'Reply to an image sticker with .toimg.'
                    }, { quoted: msg });
                }

                const buffer = await downloadMediaMessage(
                    message, 'buffer', {}
                );

                return sock.sendMessage(jid, {
                    image: buffer,
                    caption: 'Converted image'
                }, { quoted: msg });
            }

            if (!image && !video) {
                return sock.sendMessage(jid, {
                    text: 'Send or reply to an image with .sticker.'
                }, { quoted: msg });
            }

            if (video) {
                return sock.sendMessage(jid, {
                    text: 'Video sticker conversion is not included in this image-only plugin.'
                }, { quoted: msg });
            }

            const buffer = await downloadMediaMessage(
                message, 'buffer', {}
            );

            const sticker = await sharp(buffer)
                .resize(512, 512, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .webp()
                .toBuffer();

            return sock.sendMessage(jid, {
                sticker
            }, { quoted: msg });

        } catch (error) {
            console.error('Sticker error:', error.message);

            return sock.sendMessage(jid, {
                text: '❌ Sticker conversion failed.'
            }, { quoted: msg });
        }
    }
};
