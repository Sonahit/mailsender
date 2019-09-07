const auth = require("./authorize");
const Logger = require("./logger");
const fs = require("fs");
const credentials = JSON.parse(fs.readFileSync(process.env.CREDENTIALS_PATH));
const mailing = require("./mailing");
const message = require("./message");
const logger = new Logger();
global.logger = logger;

if (process.env.DEBUG_LOGGER) {
  auth(credentials).then(client => {
    message.checkForTokens(client).then(response => {
      global.logger.info(response);
      mailing.mailMessagesToSubscribers(client).then(response => {
        global.logger.info(response);
      });
    });
  });
}

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
    logger.info("Cleared stack trace");
    const date = new Date();
    fs.writeFileSync(__dirname + `/logs/log_${Date.now()}_${date.getDay + date.getMonth()}.log`, logger.stack);
    logger.stack = [];
  }, interval);
};
module.exports.backupData = function backupData(interval) {
  setInterval(() => {
    logger.info("Backing up data");
    fs.writeFile("./backups/config.backup.json", fs.readFileSync("./config/config.json"), err => {
      if (err) logger.info(err);
    });
  }, interval);
};
