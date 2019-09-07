const fs = require("fs");
const interactions = require("./src/interactions");

global.logger.info("Started mailing...");
interactions.messageSubs(10 * 1000 * 60);
interactions.clearStackTrace(30 * 1000 * 60);
interactions.backupData(5 * 60 * 1000);

process.on("uncaughtException", error => {
  const date = new Date();
  global.logger.info(error);
  fs.writeFileSync(__dirname + `/logs/log_${Date.now()}_${date.getDay() + date.getMonth()}.log`, error);
  fs.writeFileSync(__dirname + `/logs/log_${Date.now()}_${date.getDay() + date.getMonth()}.log`, global.logger.stack);
});

process.on("beforeExit", code => {
  const date = new Date();
  global.logger.info(`Exited with ${code}`);
  fs.writeFileSync(__dirname + `/logs/log_${Date.now()}_${date.getDay() + date.getMonth()}.log`, global.logger.stack);
});
