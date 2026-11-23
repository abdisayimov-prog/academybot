/**
 * Apex Academy - Server & Cloudflare Tunnel Runner
 * 1. server.js ni ishga tushiradi (3000-port)
 * 2. cloudflared tunnel ni ulaydi
 * 3. Olingan HTTPS havolani bot_config.json ga avtomatik yozadi
 * 4. BotFather dagi menyu tugmasini avtomatik yangi URL ga yangilaydi
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');

const PORT = 3000;
const CLOUDFLARED_PATH = path.join(__dirname, 'cloudflared.exe');
const CONFIG_PATH = path.join(__dirname, 'bot_config.json');

console.log('🚀 Apex Academy Web ilovasi va Cloudflare Tunnel sozlanmoqda...\n');

// 1. Web serverni ishga tushirish
const webServer = spawn('node', [path.join(__dirname, 'server.js')], {
  stdio: 'inherit'
});

webServer.on('error', (err) => {
  console.error('❌ Web serverda xato:', err);
});

// Telegram Bot Menu Button ni avtomatik yangilash
function updateTelegramMenuButton(botToken, webAppUrl) {
  if (!botToken) return;
  const payload = JSON.stringify({
    menu_button: {
      type: 'web_app',
      text: '📱 Apex Ilova',
      web_app: { url: webAppUrl }
    }
  });

  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${botToken}/setChatMenuButton`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
      try {
        const json = JSON.parse(body);
        if (json.ok) {
          console.log('⚡ Telegram Botdagi Menu Button yangi URL ga AVTOMATIK ulandi! (OK)');
        }
      } catch (e) {}
    });
  });
  req.on('error', () => {});
  req.write(payload);
  req.end();
}

// 2. Cloudflare tunnelni ishga tushirish
setTimeout(() => {
  console.log('\n🌐 Cloudflare Tunnel ulanmoqda...');
  const tunnel = spawn(CLOUDFLARED_PATH, ['tunnel', '--url', `http://localhost:${PORT}`]);

  let publicUrl = null;

  tunnel.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && !publicUrl) {
      publicUrl = match[0];
      console.log('\n' + '='.repeat(60));
      console.log('🎉 CLOUDFLARE TUNNEL MUVAFFAQIYATLI ULINDI!');
      console.log(`🔗 Sizning Web App HTTPS manzilingiz:`);
      console.log(`👉 \x1b[32m\x1b[1m${publicUrl}\x1b[0m`);
      console.log('='.repeat(60) + '\n');

      // bot_config.json ga yozish
      try {
        let cfg = {};
        if (fs.existsSync(CONFIG_PATH)) {
          cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        }
        cfg.web_app_url = publicUrl;
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
        console.log('💾 bot_config.json yangilandi: web_app_url = ' + publicUrl);

        // Telegram menyu tugmasini avtomatik yangilash
        if (cfg.bot_token) {
          updateTelegramMenuButton(cfg.bot_token, publicUrl);
        }
      } catch (e) {
        console.error('Config saqlashda xato:', e);
      }
    }
  });

  tunnel.on('close', (code) => {
    console.log(`Cloudflare tunnel to'xtadi (kod: ${code})`);
  });

  process.on('SIGINT', () => {
    webServer.kill();
    tunnel.kill();
    process.exit();
  });
}, 1500);
