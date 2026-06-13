const http = require('http');

const SYNC_SECRET = process.env.SYNC_SECRET;
const APP_URL = process.env.APP_URL || 'http://app:3000';
const REQUEST_TIMEOUT_MS = Number(process.env.SYNC_REQUEST_TIMEOUT_MS || 35 * 60 * 1000);
const RETRY_INTERVAL_MS = Number(process.env.SYNC_RETRY_INTERVAL_MS || 5 * 60 * 1000);

function getKstParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now);

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

  return new Promise((resolve) => {
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'X-Sync-Secret': SYNC_SECRET || '',
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const succeeded = Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 300);
        console.log(
          `[${new Date().toISOString()}] Sync API responded. Status: ${res.statusCode}. Body: ${data}`
        );
        resolve(succeeded);
      });
    });

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`Sync request timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });
    req.on('error', (error) => {
      console.error(`[${new Date().toISOString()}] Sync trigger failed:`, error.message);
      resolve(false);
    });
    req.write(JSON.stringify({ startDateKey, endDateKey }));
    req.end();
  });
}

function createScheduler(options = {}) {
  const runSync = options.triggerSync || triggerSync;
  const retryIntervalMs = options.retryIntervalMs || RETRY_INTERVAL_MS;
  let completedDate = null;
  let lastAttemptAt = 0;
  let inFlight = false;

  return async function tick(now = new Date()) {
    const { year, month, day, hour } = getKstParts(now);
    const today = `${year}-${month}-${day}`;
    const afterSchedule = Number(hour) >= 6;
    const retryDue = now.getTime() - lastAttemptAt >= retryIntervalMs;

    if (!afterSchedule || completedDate === today || inFlight || !retryDue) {
      return;
    }

    inFlight = true;
    lastAttemptAt = now.getTime();
    const startDateKey = day === '01' ? previousMonthStart(year, month) : today;

    try {
      const succeeded = await runSync(startDateKey, today);
      if (succeeded) {
        completedDate = today;
      } else {
        console.error(`[${new Date().toISOString()}] Sync will retry after the retry interval.`);
      }
    } finally {
      inFlight = false;
    }
  };
}

function startScheduler() {
  console.log('Nonghyup Ledger Sync Scheduler started.');
  console.log(`Target endpoint: ${APP_URL}`);
  console.log(`Secret configured: ${SYNC_SECRET ? 'yes' : 'no'}`);

  const tick = createScheduler();
  void tick();
  setInterval(() => {
    void tick();
  }, 60 * 1000);
}

if (require.main === module) {
  startScheduler();
}

module.exports = {
  createScheduler,
  getKstParts,
  previousMonthStart,
  triggerSync
};
