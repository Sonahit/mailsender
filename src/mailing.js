const fs = require("fs");
const { google } = require("googleapis");
const config = JSON.parse(fs.readFileSync("./config/config.json"));
const { subscribers, host } = config;
const hasToken = require("./authorize").hasToken;
const modifier = require("./modify");
const messageProvider = require("./message.js");

module.exports.mailMessagesToSubscribers = function mailMessagesToSubscribers(auth) {
  const gmail = google.gmail({ version: "v1", auth });
  return new Promise((resolve, reject) => {
    global.logger.info("Searching for unread messages");
    messageProvider.getUnreadMessages(gmail).then(response => {
      const { data } = response;
      if (data.messages) {
        resolve(data);
      } else {
        reject("There was no new messages\nDone searching");
      }
    });
  })
    .then(async data => {
      for (const msg of data.messages) {
        const currentMsg = await messageProvider.getMessageData(gmail, msg);
        const { PROVIDER_TOKEN, SUBSCRIBER_TOKEN, UNSUBSCRIBE_TOKEN, NONPROVIDING_TOKEN } = config;
        if (
          !(
            hasToken(currentMsg, PROVIDER_TOKEN) ||
            hasToken(currentMsg, SUBSCRIBER_TOKEN) ||
            hasToken(currentMsg, UNSUBSCRIBE_TOKEN) ||
            hasToken(currentMsg, NONPROVIDING_TOKEN)
          )
        ) {
          const isProvider = await messageProvider.isProvider(gmail, msg);
          global.logger.info(`Is author a msg provider ? ${isProvider ? "Yes" : "No"}`);
          if (currentMsg.data && isProvider) {
            const { data } = currentMsg;
            global.logger.info("Starting messaging subscribers...");
            const accessToken = auth.credentials.access_token;
            const messageBody = await modifier.prepareMessageBody(gmail, data);
            if (!process.env.DEBUG_LOGGER) {
              subscribers.forEach(sub => {
                const messageHeaders = modifier.prepareMessageHeaders(data.payload.headers, sub, host);
                const message = {
                  body: messageBody,
                  headers: messageHeaders
                };
                messageProvider.sendMessage(message, accessToken);
              });
            } else {
              global.logger.info("DEBUG");
              const user = { firstName: "Иван", lastName: "Садыков", email: "grandpajok@gmail.com" };
              const messageHeaders = modifier.prepareMessageHeaders(data.payload.headers, user, host);
              const message = {
                body: messageBody,
                headers: messageHeaders
              };
              messageProvider.sendMessage(message, accessToken);
            }
            modifier.removeLabels(gmail, data, ["UNREAD"]);
          } else {
            modifier.removeLabels(gmail, currentMsg.data, ["UNREAD"]);
            messageProvider.trashMessage(gmail, msg);
          }
        }
      }
    })
    .then(() => {
      return "Done messaging";
    })
    .catch(err => {
      return err;
    });
};
