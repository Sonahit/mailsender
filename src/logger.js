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
    return message;
  }

  error(message) {
    console.error(`info: ${message}`);
    const json = JSON.stringify({
      Message: message,
      Date: Date.now()
    });
    this.stack.push(json);
    return message;
  }
};
