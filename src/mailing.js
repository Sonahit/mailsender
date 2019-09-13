const fs = require("fs");
const { google } = require("googleapis");
const hasToken = require("./authorize").hasToken;
const modifier = require("./modify");
const messageProvider = require("./message.js");

/**
 * @param {google.auth.OAuth2} oAuth2Client The client which will message
 * @returns {Promise} returns a Promise which will send a message or do not send it
 */
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
      const config = JSON.parse(fs.readFileSync("./config/config.json"));
      const { subscribers, host } = config;
      const { PROVIDER_TOKEN, SUBSCRIBER_TOKEN, UNSUBSCRIBE_TOKEN, NONPROVIDING_TOKEN, providers } = config;
      //Looking through every unread message
      for (const msg of data.messages) {
        const currentMsg = await messageProvider.getMessageData(gmail, msg);
        if (
          !(
            hasToken(currentMsg, PROVIDER_TOKEN) ||
            hasToken(currentMsg, SUBSCRIBER_TOKEN) ||
            hasToken(currentMsg, UNSUBSCRIBE_TOKEN) ||
            hasToken(currentMsg, NONPROVIDING_TOKEN)
          )
        ) {
          const isProvider = await messageProvider.isProvider(gmail, msg, providers);
          global.logger.info(`Is author a msg provider ? ${isProvider ? "Yes" : "No"}`);
          if (currentMsg.data && isProvider) {
            const { data } = currentMsg;
            global.logger.info("Starting messaging subscribers...");
            const accessToken = auth.credentials.access_token;
            const messageBody = await modifier.prepareMessageBody(gmail, data);
            //const user = { firstName: "Иван", lastName: "Садыков", email: "grandpajok@gmail.com" }; for debugging
            subscribers.forEach(sub => {
              const messageHeaders = modifier.prepareMessageHeaders(data.payload.headers, sub, host);
              const message = {
                body: messageBody,
                headers: messageHeaders
              };
              messageProvider.sendMessage(message, accessToken);
            });
            modifier.removeLabels(gmail, data, ["UNREAD"]);
          } else {
            modifier.removeLabels(gmail, currentMsg.data, ["UNREAD"]);
            messageProvider.trashMessage(gmail, currentMsg.data);
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
