module.exports = class Logger {
  constructor(level = "info") {
    this.level = level;
    this.stack = [];
  }

  info(...message) {
    const date = new Date().toString().split(" ");
    if (message.toString().indexOf("\n") !== -1) {
      message
        .toString()
        .split("\n")
        .forEach(msg => {
          console.log(`[${date[0]}] ${date[4]} ${date[5]}\t[INFO]: ${msg}`);
          this.toStackTrace(`[${date[0]}] ${date[4]} ${date[5]}\t[INFO]: ${msg}`);
        });
    } else {
      const infoMessage = `[${date[0]}] ${date[4]} ${date[5]}\t[INFO]: ${message}`;
      console.log(infoMessage);
      this.toStackTrace(infoMessage);
    }
  }

  error(...message) {
    let date = new Date().toString().split(" ");
    if (message.toString().indexOf("\n") !== -1) {
      message
        .toString()
        .split("\n")
        .forEach(msg => {
          console.error(`[${date[0]}] ${date[4]} ${date[5]}\t[ERROR]: ${msg}`);
          this.toStackTrace(`[${date[0]}] ${date[4]} ${date[5]}\t[ERROR]: ${msg}`);
        });
    } else {
      const errorMessage = `[${date[0]}] ${date[4]} ${date[5]}\t[ERROR]: ${message}`;
      console.error(errorMessage);
      this.toStackTrace(errorMessage);
    }
    const fs = require("fs");
    const path = process.env.ROOT_PATH + `/logs`;
    date = new Date();
    fs.writeFileSync(`${path}/log_${Date.now()}_${date.getDay()}_${date.getMonth()}.log`, JSON.stringify(global.logger.stack, null, 4));
  }

  toStackTrace(stack) {
    this.stack.push(stack);
  }
};
