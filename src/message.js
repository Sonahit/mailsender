const fs = require("fs");
const { google } = require("googleapis");
const path = require("path");
const config = JSON.parse(fs.readFileSync("./config/config.json"));
const { providers, subscribers, PROVIDER_TOKEN, SUBSCRIBER_TOKEN } = config;
const configPath = path.resolve("config/config.json");
const hasToken = require("./authorize").hasToken;
const labelModifier = require("./modify");
const messageProvider = require("./message.js");

module.exports.getUnreadMessages = function getUnreadMessages(gmail) {
  return gmail.users.messages
    .list({
      userId: "me",
      q: "is:unread"
    })
    .then(response => {
      return {
        ...response
      };
    });
};

function getMessageAuthor(gmail, msg) {
  return getMessageData(gmail, msg.id ? msg : msg.data).then(msg => {
    const { data } = msg;
    const rawData = data.payload.headers.find(header => header.name === "From");
    const author = rawData.value.split(" ");
    const email = author
      .find(userData => {
        return userData.match(/^<(.+)@.+>$/gi);
      })
      .replace(/<|>/g, "");

    return {
      email: email,
      firstName: author[0] || "",
      lastName: author[1].includes(email) ? "" : author[1]
    };
  });
}

module.exports.isProvider = async function isProvider(gmail, msg) {
  const author = await getMessageAuthor(gmail, msg);
  return providers.some(provider => provider.email === author.email);
};

module.exports.isSubscriber = async function isSubscriber(gmail, msg) {
  const author = await getMessageAuthor(gmail, msg);
  return subscribers.some(subscriber => subscriber.email === author.email);
};

function getMessageData(gmail, msgData) {
  return gmail.users.messages
    .get({
      userId: "me",
      id: msgData.id
    })
    .then(response => {
      return response;
    })
    .catch(err => {
      console.log(err);
    });
}

module.exports.checkForTokens = async function checkForTokens(auth) {
  const gmail = google.gmail({ version: "v1", auth });
  global.logger.info("Checking for tokens");
  messageProvider.getUnreadMessages(gmail).then(response => {
    const { data } = response;
    if (data.messages) {
      data.messages.forEach(async msg => {
        const currentMsg = await messageProvider.getMessageData(gmail, msg);
        const isProvider = await messageProvider.isProvider(gmail, msg);
        const isSubscriber = await messageProvider.isSubscriber(gmail, msg);
        if (hasToken(currentMsg, PROVIDER_TOKEN) && !isProvider) {
          const author = await messageProvider.getMessageAuthor(gmail, msg);
          if (!config.providers.some(provs => provs.email === author.email)) {
            config.providers.push(author);
            fs.writeFile(configPath, JSON.stringify(config), err => {
              global.logger.info(`Overwriting existing config.providers with author's message \n ${currentMsg.data.snippet}`);
              if (err) {
                return global.logger.info(err);
              }
              labelModifier.removeLabels(gmail, currentMsg.data, ["UNREAD"]);
            });
          }
        } else if (hasToken(currentMsg, SUBSCRIBER_TOKEN) && !isSubscriber) {
          const author = await messageProvider.getMessageAuthor(gmail, msg);
          if (!config.subscribers.some(subs => subs.email === author.email)) {
            config.subscribers.push(author);
            fs.writeFile(configPath, JSON.stringify(config), err => {
              global.logger.info(`Overwriting existing config.subscribers with author's message \n ${currentMsg.data.snippet}`);
              if (err) {
                return global.logger.info(err);
              }
              labelModifier.removeLabels(gmail, currentMsg.data, ["UNREAD"]);
            });
          }
        }
      });
    }
  });
};

function sendMessage(gmail, user, message, msgData, host) {
  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const options = {
    userId: "me",
    requestBody: {
      raw: encodedMessage
    },
    threadId: msgData.threadId
  };
  gmail.users.messages
    .send(options)
    .then(currentMsg => {
      global.logger.info(`Send message ${currentMsg.data.id} to ${user.email} from ${host.email}`);
      labelModifier.removeLabels(gmail, msgData, ["UNREAD"]);
    })
    .catch(err => {
      global.logger.info("Didn't send message");
      console.error(err);
    });
}

module.exports.sendMessage = sendMessage;
module.exports.getMessageAuthor = getMessageAuthor;
module.exports.getMessageData = getMessageData;
