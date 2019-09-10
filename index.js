const fs = require("fs");
const Logger = require("./src/logger");
const logger = new Logger("info");
global.logger = logger;
process.env.ROOT_PATH = require("path").resolve(__dirname);
const interactions = require("./src/interactions");

/**
 * @param min minutes
 * @description get minutes in milliseconds
 */
const minutes = mins => mins * 1000 * 60;

// Setting up main flow
global.logger.info("Started mailing...");
interactions.messageSubs(minutes(5));
interactions.clearStackTrace(minutes(30));
interactions.backupData(minutes(10));

process.on("uncaughtException", error => {
  const date = new Date();
  global.logger.error(error.stack);
  const path = process.env.ROOT_PATH + `/logs`;
  fs.writeFileSync(`${path}/log_${Date.now()}_${date.getDay()}_${date.getMonth()}_error.log`, JSON.stringify(error, null, 4));
  fs.writeFileSync(`${path}/log_${Date.now()}_${date.getDay()}_${date.getMonth()}.log`, JSON.stringify(global.logger.stack, null, 4));
  process.exit(1);
});

process.on("beforeExit", code => {
  const date = new Date();
  global.logger.info(`Exited with ${code}`);
  const path = process.env.ROOT_PATH + `/logs`;
  fs.writeFileSync(`${path}/log_${Date.now()}_${date.getDay()}_${date.getMonth()}.log`, JSON.stringify(global.logger.stack, null, 4));
});

process.on("exit", code => {
  const date = new Date();
  global.logger.info(`Exited with ${code}`);
  const path = process.env.ROOT_PATH + `/logs`;
  fs.writeFileSync(`${path}/log_${Date.now()}_${date.getDay()}_${date.getMonth()}.log`, JSON.stringify(global.logger.stack, null, 4));
});
