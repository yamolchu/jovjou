const Imap = require('imap');
const MailParser = require('mailparser').MailParser;
const simpleParser = require('mailparser').simpleParser;

function verifyEmail(email) {
  return new Promise((resolve, reject) => {
    const imapConfig = {
      user: email.email,
      password: email.imapPass,
      host: 'outlook.office365.com',
      port: 993,
      tls: true,
    };
    const searchCriteria = [['FROM', 'hello@getlaunchlist.com']];

    const imap = new Imap(imapConfig);

    function openInbox(cb) {
      imap.openBox('INBOX', true, cb);
    }

    imap.once('ready', function () {
      openInbox(function (err, box) {
        if (err) reject(err);
        imap.search(searchCriteria, function (err, results) {
          if (err) reject(err);

          const fetch = imap.fetch(results, { bodies: '' });

          fetch.on('message', function (msg, seqno) {
            const mailparser = new MailParser();

            msg.on('body', (stream, info) => {
              simpleParser(stream, (err, parsed) => {
                if (err) reject(err);

                const regex = /https?:\/\/[^\s]+/g;
                const matches = parsed.text.match(regex)[0];
                if (matches) {
                  resolve(matches);
                } else {
                  resolve([]);
                }
              });
            });

            mailparser.on('end', function () {});
          });

          fetch.once('error', function (err) {
            console.log('Fetch error:', err);
            reject(err);
          });

          fetch.once('end', function () {
            imap.end();
          });
        });
      });
    });

    imap.once('error', function (err) {
      console.log('IMAP error:', err);
      reject(err);
    });

    imap.once('end', function () {
      console.log('Connection ended');
    });

    imap.connect();
  });
}

module.exports = verifyEmail;
