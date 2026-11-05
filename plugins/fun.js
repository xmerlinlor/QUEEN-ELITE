const axios = require('axios');

module.exports = {
    name: 'fun',
    commands: ['joke', 'quote', 'meme', 'truth', 'dare'],

    async handler(sock, msg, args, command) {
        const jid = msg.key.remoteJid;

        try {
            if (command === 'joke') {
                const { data } = await axios.get(
                    'https://official-joke-api.appspot.com/random_joke',
                    { timeout: 10000 }
                );

                return sock.sendMessage(jid, {
                    text: `😂 JOKE\n\n${data.setup}\n\n${data.punchline}`
                }, { quoted: msg });
            }

            if (command === 'quote') {
                const { data } = await axios.get(
                    'https://dummyjson.com/quotes/random',
                    { timeout: 10000 }
                );

                return sock.sendMessage(jid, {
                    text: `💭 QUOTE\n\n"${data.quote}"\n\n— ${data.author}`
                }, { quoted: msg });
            }

            if (command === 'meme') {
                const { data } = await axios.get(
                    'https://meme-api.com/gimme',
                    { timeout: 10000 }
                );

                return sock.sendMessage(jid, {
                    image: { url: data.url },
                    caption: `😂 ${data.title}`
                }, { quoted: msg });
            }

            if (command === 'truth' || command === 'dare') {
                const questions = command === 'truth'
                    ? [
                        'What is one skill you want to learn?',
                        'What is your funniest school memory?',
                        'What is one goal you are proud of?'
                    ]
                    : [
                        'Say three positive things about yourself.',
                        'Describe your favourite movie in five words.',
                        'Share a funny harmless joke.'
                    ];

                const choice = questions[
                    Math.floor(Math.random() * questions.length)
                ];

                return sock.sendMessage(jid, {
                    text: `${command === 'truth' ? '🤔 TRUTH' : '🎯 DARE'}\n\n${choice}`
                }, { quoted: msg });
            }

        } catch (error) {
            console.error('Fun plugin error:', error.message);

            return sock.sendMessage(jid, {
                text: '❌ Could not load this fun command. Try again later.'
            }, { quoted: msg });
        }
    }
};
