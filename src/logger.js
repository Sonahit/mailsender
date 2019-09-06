module.exports = class Logger {
  constructor() {
    this.stack = [];
    this.oldConsole = console.log;
    console.log = message => {
      this.stack.push();
      this.oldConsole(message);
    };
  }
  info(message) {
    const json = JSON.stringify({
      Message: message,
      level: "info",
      Date: Date.now()
    });
    console.log(json);
    this.stack.push(json);
  }
};
