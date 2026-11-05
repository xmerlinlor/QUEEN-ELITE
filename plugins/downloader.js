const axios = require('axios');

const URL_REGEX = /^https?:\/\/\S+$/i;

const ALLOWED_HOSTS = [
    'github.com',
    'www.github.com',
    'mediafire.com',
    'www.mediafire.com',
    'tiktok.com',
    'www.tiktok.com',
    'vm.tiktok.com',
    'instagram.com',
    'www.instagram.com',
    'facebook.com',
    'www.facebook.com',
    'fb.watch',
    'pinterest.com',
    'www.pinterest.com'
];

function validUrl(value) {
    try {
        const url = new URL(value);

        return (
            ['http:', 'https:'].includes(url.protocol) &&
            ALLOWED_HOSTS.includes(url.hostname)
        );
    } catch {
        return false;
    }
}

module.exports = {
    name: 'downloader',

    commands: [
        'play', 'song', 'video', 'tiktok',
        'instagram', 'facebook', 'mediafire',
        'apk', 'pinterest', 'github'
    ],

    async handler(sock, msg, args, command) {
        const jid = msg.key.remoteJid;
        const input = args.join(' ').trim();

        if (!input) {
            return sock.sendMessage(jid, {
                text: `Usage: .${command} URL or search query`
            }, { quoted: msg });
        }

        if (command === 'github') {
            const match = input.match(
                /(?:github\.com\/)([^/]+)\/([^/?#]+)/
            );

            if (!match) {
                return sock.sendMessage(jid, {
                    text: 'Usage: .github https://github.com/user/repository'
                }, { quoted: msg });
            }

            const [, user, repo] = match;

            try {
                const response = await axios.get(
                    `https://api.github.com/repos/${user}/${repo}`,
                    { timeout: 15000 }
                );

                const data = response.data;

                return sock.sendMessage(jid, {
                    text:
`📦 GITHUB REPOSITORY

Name: ${data.full_name}
Description: ${data.description || 'No description'}
Stars: ${data.stargazers_count}
Language: ${data.language || 'Unknown'}
Branch: ${data.default_branch}

Download:
${data.html_url}/archive/refs/heads/${data.default_branch}.zip`
                }, { quoted: msg });

            } catch {
                return sock.sendMessage(jid, {
                    text: '❌ Repository not found or unavailable.'
                }, { quoted: msg });
            }
        }

        if (!URL_REGEX.test(input) || !validUrl(input)) {
            return sock.sendMessage(jid, {
                text: '❌ Provide a valid supported public URL.'
            }, { quoted: msg });
        }

        if (command === 'mediafire') {
            return sock.sendMessage(jid, {
                text: `📁 MEDIAFIRE LINK

${input}

Open the link to download the file if you have permission.`
            }, { quoted: msg });
        }

        if (command === 'apk') {
            return sock.sendMessage(jid, {
                text: '⚠️ Only download APK files from trusted official sources. Send the official download URL.'
            }, { quoted: msg });
        }

        if (
            ['tiktok', 'instagram', 'facebook', 'pinterest'].includes(command)
        ) {
            return sock.sendMessage(jid, {
                text:
`🔗 ${command.toUpperCase()} LINK

${input}

This plugin does not bypass login, privacy, or platform download restrictions.`
            }, { quoted: msg });
        }

        return sock.sendMessage(jid, {
            text: '❌ This command needs a supported search or media API before it can download content.'
        }, { quoted: msg });
    }
};
