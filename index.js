const fs = require("fs");
const Logger = require("./src/logger");
const logger = new Logger("info");
global.logger = logger;
const interactions = require("./src/interactions");

global.logger.info("Started mailing...");
interactions.messageSubs(10 * 1000 * 60);
interactions.clearStackTrace(30 * 1000 * 60);
interactions.backupData(5 * 60 * 1000);

process.on("uncaughtException", error => {
  const date = new Date();
  global.logger.error(error);
  fs.writeFileSync(__dirname + `/logs/log_${Date.now()}_${date.getDay()}_${date.getMonth()}_error.log`, JSON.stringify(error, null, 4));
  fs.writeFileSync(__dirname + `/logs/log_${Date.now()}_${date.getDay()}_${date.getMonth()}.log`, JSON.stringify(global.logger.stack, null, 4));
});

process.on("beforeExit", code => {
  const date = new Date();
  global.logger.info(`Exited with ${code}`);
  fs.writeFileSync(__dirname + `/logs/log_${Date.now()}_${date.getDay()}_${date.getMonth()}.log`, JSON.stringify(global.logger.stack, null, 4));
});

process.on("exit", code => {
  const date = new Date();
  global.logger.info(`Exited with ${code}`);
  fs.writeFileSync(__dirname + `/logs/log_${Date.now()}_${date.getDay()}_${date.getMonth()}.log`, JSON.stringify(global.logger.stack, null, 4));
});
