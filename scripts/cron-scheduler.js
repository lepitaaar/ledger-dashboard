const http = require('http');

const SYNC_SECRET = process.env.SYNC_SECRET;
const APP_URL = process.env.APP_URL || 'http://app:3000';

console.log('Nonghyup Ledger Sync Scheduler started.');
console.log(`Target endpoint: ${APP_URL}`);
console.log(`Secret configured: ${SYNC_SECRET ? 'yes' : 'no'}`);

function getKstParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date());

  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function previousMonthStart(year, month) {
  const date = new Date(Date.UTC(Number(year), Number(month) - 2, 1));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    '01'
  ].join('-');
}

function triggerSync(startDateKey, endDateKey) {
  console.log(`[${new Date().toISOString()}] Triggering sync ${startDateKey} ~ ${endDateKey}`);
  const url = `${APP_URL}/api/auctions/sync`;

  const req = http.request(url, {
    method: 'POST',
    headers: {
      'X-Sync-Secret': SYNC_SECRET || '',
      'Content-Type': 'application/json'
    }
  }, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log(`[${new Date().toISOString()}] Sync API responded. Status: ${res.statusCode}. Body: ${data}`);
    });
  });

  req.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] Sync trigger failed with network error:`, err.message);
  });

  req.write(JSON.stringify({ startDateKey, endDateKey }));
  req.end();
}

let lastTriggeredDate = null;

// 매분 KST 06:00을 확인합니다. 매월 1일에는 전월 1일부터 당일까지 재조회합니다.
setInterval(() => {
  const { year, month, day, hour, minute } = getKstParts();
  const today = `${year}-${month}-${day}`;

  if (hour === '06' && minute === '00' && lastTriggeredDate !== today) {
    lastTriggeredDate = today;
    const startDateKey = day === '01' ? previousMonthStart(year, month) : today;
    triggerSync(startDateKey, today);
  }
}, 60 * 1000);
