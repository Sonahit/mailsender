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
    const date = new Date().toString().split(" ");
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
  }

  toStackTrace(stack) {
    this.stack.push(stack);
  }
};
