module.exports = class Logger {
  constructor() {
    this.stack = [];
  }
  info(message) {
    console.log(`info: ${message}`);
    const json = JSON.stringify({
      Message: message,
      level: "info",
      Date: Date.now()
    });
    this.stack.push(json);
  }
};
