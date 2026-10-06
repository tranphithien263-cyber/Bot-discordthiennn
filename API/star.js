if (!global.__BOT_STATE__) {
  global.__BOT_STATE__ = {
    running: false,
    sent: 0,
    startTime: 0,
    stopFlag: false,
    token: null,
    channel: null,
    content: null,
    delay: 1,
    targetCount: 0,
    error: null
  };
}

async function sendMessage(token, channelId, content) {
  try {
    var res = await fetch('https://discord.com/api/v10/channels/' + channelId + '/messages', {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordBot (https://github.com/spam, 1.0)'
      },
      body: JSON.stringify({ content: content, tts: false })
    });

    if (res.status === 200 || res.status === 201) return { ok: true };
    if (res.status === 429) {
      var data = await res.json().catch(function() { return {}; });
      return { ok: false, retry: (data.retry_after || 1) * 1000 };
    }
    if (res.status === 401) return { ok: false, fatal: 'Token sai hoặc hết hiệu lực' };
    if (res.status === 403) return { ok: false, fatal: 'Bot không có quyền gửi tin' };
    if (res.status === 404) return { ok: false, fatal: 'Channel ID không tồn tại' };
    if (res.status === 400) {
      var text = await res.text();
      return { ok: false, error: 'HTTP 400: ' + text.slice(0, 200) };
    }

    var t = await res.text();
    return { ok: false, error: 'HTTP ' + res.status + ': ' + t.slice(0, 150) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function botLoop(state) {
  while (!state.stopFlag) {
    if (state.targetCount > 0 && state.sent >= state.targetCount) {
      state.stopFlag = true;
      state.running = false;
      break;
    }

    var r = await sendMessage(state.token, state.channel, state.content);

    if (r.ok) {
      state.sent++;
    } else if (r.fatal) {
      state.error = r.fatal;
      state.stopFlag = true;
      state.running = false;
      break;
    } else if (r.retry) {
      await new Promise(function(rs) { setTimeout(rs, r.retry); });
      continue;
    }

    await new Promise(function(rs) { setTimeout(rs, state.delay * 1000); });
  }
  state.running = false;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }

  try {
    var body = req.body || {};
    var token = (body.token || '').trim();
    var channel = (body.channel || '').trim();
    var content = body.content || '';
    var delay = body.delay || 1;
    var targetCount = parseInt(body.targetCount) || 0;

    if (!token || !channel || !content) {
      res.status(400).json({ ok: false, error: 'Thiếu token / channel / nội dung' });
      return;
    }

    if (!token.toLowerCase().startsWith('bot ')) {
      token = 'Bot ' + token;
    }

    var state = global.__BOT_STATE__;
    if (state.running) {
      state.stopFlag = true;
      await new Promise(function(rs) { setTimeout(rs, 400); });
    }

    state.running = true;
    state.sent = 0;
    state.startTime = Date.now();
    state.stopFlag = false;
    state.token = token;
    state.channel = channel;
    state.content = content;
    state.delay = Math.max(0.005, parseFloat(delay) || 1);
    state.targetCount = targetCount;
    state.error = null;

    botLoop(state).catch(function(e) {
      state.error = e.message;
      state.running = false;
    });

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
