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
        });
    } else {
      console.log(`[${date[0]}] ${date[4]} ${date[5]}\t[INFO]: ${message}`);
    }
    const json = JSON.stringify({
      Message: message,
      level: this.level,
      Date: date
    });
    this.toStackTrace(json);
    return message;
  }

  error(...message) {
    const date = new Date().toString().split(" ");
    if (message.toString().indexOf("\n") !== -1) {
      message
        .toString()
        .split("\n")
        .forEach(msg => {
          console.error(`[${date[0]}] ${date[4]} ${date[5]}\t[INFO]: ${msg}`);
        });
    } else {
      console.error(`[${date[0]}] ${date[4]} ${date[5]}\t[INFO]: ${message}`);
    }
    const json = JSON.stringify({
      Message: message,
      level: this.level,
      Date: date
    });
    this.toStackTrace(json);
    return message;
  }

  toStackTrace(stack) {
    this.stack.push(stack);
  }
};
