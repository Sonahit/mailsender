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
    global.logger.info("Cleared stack trace");
    const date = new Date();
    fs.writeFileSync(__dirname + `/logs/log_${Date.now()}_${date.getDay + date.getMonth()}.log`, global.logger.stack);
    global.logger.stack = [];
  }, interval);
};
module.exports.backupData = function backupData(interval) {
  setInterval(() => {
    global.logger.info("Backing up data");
    fs.writeFile("./backups/config.backup.json", fs.readFileSync("./config/config.json"), err => {
      if (err) global.logger.info(err);
    });
  }, interval);
};
