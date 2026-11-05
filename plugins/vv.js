const {
    downloadContentFromMessage
} = require('@whiskeysockets/baileys');

const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '../temp');

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

async function downloadMedia(message, type) {
    const stream = await downloadContentFromMessage(message, type);
    let buffer = Buffer.alloc(0);

    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }

    return buffer;
}

module.exports = {
    name: 'vv',
    commands: ['vv'],

    async handler(sock, msg) {
        const jid = msg.key.remoteJid;
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted) {
            return sock.sendMessage(jid, {
                text: 'Reply to a view-once image or video with .vv.'
            }, { quoted: msg });
        }

        const media =
            quoted.viewOnceMessage?.message ||
            quoted.viewOnceMessageV2?.message ||
            quoted.viewOnceMessageV2Extension?.message;

        if (!media) {
            return sock.sendMessage(jid, {
                text: '❌ No supported view-once media found.'
            }, { quoted: msg });
        }

        try {
            const image = media.imageMessage;
            const video = media.videoMessage;

            if (!image && !video) {
                return sock.sendMessage(jid, {
                    text: '❌ Only image and video media are supported.'
                }, { quoted: msg });
            }

            const type = image ? 'image' : 'video';
            const buffer = await downloadMedia(image || video, type);

            await sock.sendMessage(jid, {
                [type]: buffer,
                caption: 'META AI V2'
            }, { quoted: msg });

        } catch (error) {
            console.error('VV plugin error:', error.message);

            await sock.sendMessage(jid, {
                text: '❌ Could not retrieve this media.'
            }, { quoted: msg });
        }
    }
};
