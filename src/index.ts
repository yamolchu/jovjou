const { random } = require('user-agents');
const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');
const { Worker, workerData, isMainThread } = require('worker_threads');
const fetchOtpCode = require('./fetchOtpCode');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const config = require('../inputs/config.ts');
const csvWriter = createCsvWriter({
  path: './result.csv',
  header: [
    { id: 'email', title: 'Email' },
    { id: 'proxy', title: 'Proxy' },
    { id: 'wallet', title: 'Wallet' },
  ],
  append: true,
});

function delay(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
const numThreads = config.numThreads;
const customDelay = config.customDelay;

function parseEmails(filePath: string) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const emails: { email: string; imapPass: string }[] = [];

  lines.forEach((line: string) => {
    const [email = '', imapPass = ''] = line.split(':');
    emails.push({ email: email.trim(), imapPass: imapPass.trim() });
  });

  return emails;
}
function parseProxies(filePath: string) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const proxies: string[] = [];

  lines.forEach((line: string) => {
    const proxy = line.trim();
    proxies.push(proxy);
  });

  return proxies;
}

function parseWallets(filePath: string) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const wallets: string[] = [];

  lines.forEach((line: string) => {
    const wallet = line.trim();
    wallets.push(wallet);
  });

  return wallets;
}
const emails = parseEmails('./inputs/emails.txt');
const proxies = parseProxies('./inputs/proxies.txt');
const wallets = parseWallets('./inputs/wallets.txt');

async function reg(email: any, proxy: string, wallet: string) {
  const headers = {
    'user-agent': random().toString(),
    authority: 'getlaunchlist.com',
    accept: 'application/json, text/plain, */*',
    'accept-language': 'en-US,en;q=0.9,uk;q=0.8',
    'content-type': 'application/json',
    referer: 'https://jovjou.com/',
    origin: 'https://jovjou.com',
    'sec-ch-ua': '"Chromium";v="116", "Not)A;Brand";v="24", "Google Chrome";v="116"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'cross-site',
  };
  const session = axios.create({
    headers: headers,
    httpsAgent:
      config.proxyType === 'http' ? new HttpsProxyAgent(`http://${proxy}`) : new SocksProxyAgent(`socks5://${proxy}`),
  });
  const FormData = require('form-data');
  const formData = new FormData();

  formData.append('email', email.email);
  formData.append('wallet', wallet);
  const res = await session.post(`https://getlaunchlist.com/s/81bVM0?ref=${config.ref}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  console.log(res.data);
  await delay(config.emailCodeDelay);
  const link = await fetchOtpCode(email);
  await session.get(link);

  const resultData = [
    {
      email: email.email,
      proxy: proxy,
      wallet: wallet,
    },
  ];
  await csvWriter
    .writeRecords(resultData)
    .then(() => {
      console.log('CSV file has been saved.');
    })
    .catch((error: any) => {
      console.error(error);
    });
}

function regRecursive(emails: any, proxies: any, wallets: any, index = 0, numThreads = 4) {
  if (index >= emails.length) {
    return;
  }

  const worker = new Worker(__filename, {
    workerData: { email: emails[index], proxy: proxies[index], wallet: wallets[index] },
  });
  worker.on('message', (message: any) => {
    console.log(message);
  });
  worker.on('error', (error: any) => {
    console.error(error);
  });
  worker.on('exit', (code: any) => {
    if (code !== 0) {
      console.error(`Thread Exit ${code}`);
    }
    regRecursive(emails, proxies, wallets, index + numThreads, numThreads);
  });
}
const main = async () => {
  if (isMainThread) {
    for (let i = 0; i < numThreads; i++) {
      await delay(customDelay);
      regRecursive(emails, proxies, wallets, i, numThreads);
    }
  } else {
    await delay(customDelay);
    const { email, proxy, wallet } = workerData;
    reg(email, proxy, wallet);
  }
};
main();
