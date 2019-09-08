module.exports = class Logger {
  constructor() {
    this.stack = [];
  }

  info(...message) {
    const date = new Date();
    console.log(`[${date.getUTCDay()}] ${date.getUTCHours()}:${date.getUTCMinutes()}\t[INFO]: ${message}`);
    const json = JSON.stringify({
      Message: message,
      level: "info",
      Date: Date.now()
    });
    this.stack.push(json);
    return message;
  }

  error(...message) {
    const date = new Date();
    console.error(`[${date.getUTCDay()}] ${date.getUTCHours()}:${date.getUTCMinutes()}\t[ERROR]: ${message}`);
    const json = JSON.stringify({
      Message: message,
      Date: Date.now()
    });
    this.stack.push(json);
    return message;
  }

  toStackTrace(stack) {
    this.stack.push(stack);
  }
};
