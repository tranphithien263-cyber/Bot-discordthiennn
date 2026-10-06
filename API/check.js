export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }

  try {
    var token = (req.body && req.body.token) || '';
    if (!token) {
      res.status(400).json({ ok: false, error: 'Thiếu token' });
      return;
    }

    var cleanToken = token.trim();
    if (!cleanToken.toLowerCase().startsWith('bot ')) {
      cleanToken = 'Bot ' + cleanToken;
    }

    var headers = {
      'Authorization': cleanToken,
      'User-Agent': 'DiscordBot (https://github.com/spam, 1.0)'
    };

    var botRes = await fetch('https://discord.com/api/v10/users/@me', { headers: headers });

    if (botRes.status === 401) {
      res.status(200).json({ ok: false, error: 'Token sai hoặc hết hiệu lực' });
      return;
    }
    if (!botRes.ok) {
      res.status(200).json({ ok: false, error: 'Token lỗi HTTP ' + botRes.status });
      return;
    }
    var bot = await botRes.json();

    var guildsRes = await fetch('https://discord.com/api/v10/users/@me/guilds', { headers: headers });
    var guilds = guildsRes.ok ? await guildsRes.json() : [];

    var channels = [];

    for (var i = 0; i < guilds.length; i++) {
      var guild = guilds[i];
      try {
        var chRes = await fetch('https://discord.com/api/v10/guilds/' + guild.id + '/channels', { headers: headers });
        if (!chRes.ok) continue;
        var chList = await chRes.json();
        for (var j = 0; j < chList.length; j++) {
          var ch = chList[j];
          // Type 0 = text channel, type 5 = announcement
          if (ch.type === 0 || ch.type === 5) {
            channels.push({
              id: ch.id,
              name: ch.name,
              guildId: guild.id,
              guildName: guild.name
            });
          }
        }
      } catch (e) {}
    }

    res.status(200).json({
      ok: true,
      botName: bot.username,
      botDiscriminator: bot.discriminator || '0',
      botId: bot.id,
      channels: channels
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
