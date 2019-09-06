const fs = require("fs");
const credentials = JSON.parse(fs.readFileSync(process.env.CREDENTIALS_PATH));
const mailing = require("./src/mailing");
const auth = require("./src/authorize");
const Logger = require("./src/logger");
const logger = new Logger();
global.logger = logger;

logger.info("Started mailing...");
auth(credentials, mailing.mailMessagesToSubscribers);

setInterval(() => {
  auth(credentials, mailing.mailMessagesToSubscribers);
}, 1 * 1000 * 60);

setInterval(() => {
  logger.info("Cleared stack trace");
  const date = new Date();
  fs.writeFileSync(__dirname + `/logs/log_${Date.now()}_${date.getDay + date.getMonth()}.log`, logger.stack);
  logger.stack = [];
}, 30 * 1000 * 60);

process.on("uncaughtException", error => {
  const date = new Date();
  logger.info(error);
  fs.writeFileSync(__dirname + `/logs/log_${Date.now()}_${date.getDay() + date.getMonth()}.log`, error);
  fs.writeFileSync(__dirname + `/logs/log_${Date.now()}_${date.getDay() + date.getMonth()}.log`, logger.stack);
});

process.on("beforeExit", code => {
  const date = new Date();
  logger.info(`Exited with ${code}`);
  fs.writeFileSync(__dirname + `/logs/log_${Date.now()}_${date.getDay() + date.getMonth()}.log`, logger.stack);
});
