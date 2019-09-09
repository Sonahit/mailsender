const auth = require("./authorize");
const fs = require("fs");
const credentials = JSON.parse(fs.readFileSync(process.env.CREDENTIALS_PATH));
const mailing = require("./mailing");
const message = require("./message");

//Launched on the start
auth(credentials).then(client => {
  message.checkForTokens(client).then(response => {
    global.logger.info(response);
    mailing.mailMessagesToSubscribers(client).then(response => {
      global.logger.info(response);
    });
  });
});

module.exports.messageSubs = function messageSubs(interval) {
  setInterval(() => {
    auth(credentials).then(client => {
      message.checkForTokens(client).then(response => {
        global.logger.info(response);
        mailing.mailMessagesToSubscribers(client).then(response => {
          global.logger.info(response);
        });
      });
    });
  }, interval);
};

module.exports.clearStackTrace = function clearStackTrace(interval) {
  setInterval(() => {
    const date = new Date();
    fs.writeFileSync(__dirname + `/logs/log_${Date.now()}_${date.getDay()}_${date.getMonth()}.log`, JSON.stringify(global.logger.stack, null, 4));
    global.logger.stack = [];
    global.logger.info("Cleared stack trace");
  }, interval);
};
module.exports.backupData = function backupData(interval) {
  setInterval(() => {
    global.logger.info("Backing up data");
    fs.writeFile("./backups/config.backup.json", fs.readFileSync("./config/config.json"), err => {
      if (err) global.logger.error(err);
    });
  }, interval);
};
