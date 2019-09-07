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
      global.logger.error(err);
    });
}

module.exports.checkForTokens = function checkForTokens(auth) {
  return new Promise(resolve => {
    const gmail = google.gmail({ version: "v1", auth });
    global.logger.info("Searching for tokens");
    messageProvider
      .getUnreadMessages(gmail)
      .then(response => {
        const { data } = response;
        if (data.messages) {
          data.messages.forEach(async msg => {
            const currentMsg = await messageProvider.getMessageData(gmail, msg);
            const isProvider = await messageProvider.isProvider(gmail, msg);
            const isSubscriber = await messageProvider.isSubscriber(gmail, msg);
            const author = await messageProvider.getMessageAuthor(gmail, msg);
            if (hasToken(currentMsg, PROVIDER_TOKEN) && !isProvider) {
              if (!config.providers.some(provs => provs.email === author.email)) {
                config.providers.push(author);
                fs.writeFile(configPath, JSON.stringify(config, null, 4), err => {
                  global.logger.info(`Overwriting existing config.providers with author's message \n ${currentMsg.data.snippet}`);
                  if (err) {
                    return global.logger.info(err);
                  }
                  labelModifier.removeLabels(gmail, currentMsg.data, ["UNREAD"]);
                });
              }
            } else if (hasToken(currentMsg, SUBSCRIBER_TOKEN) && !isSubscriber) {
              if (!config.subscribers.some(subs => subs.email === author.email)) {
                config.subscribers.push(author);
                fs.writeFile(configPath, JSON.stringify(config, null, 4), err => {
                  global.logger.info(`Overwriting existing config.subscribers with author's message \n ${currentMsg.data.snippet}`);
                  if (err) {
                    return global.logger.info(err);
                  }
                  labelModifier.removeLabels(gmail, currentMsg.data, ["UNREAD"]);
                });
              }
            } else {
              global.logger.info(`Couldn't find any tokens`);
            }
          });
        } else {
          global.logger.info(`There was no new messages.`);
        }
      })
      .then(() => {
        resolve();
      });
  }).then(() => {
    const message = `Done searching for tokens`;
    return message;
  });
};

async function sendMessage(message, token) {
  const preparedMessage = message.headers.concat(message.body).join("\n");
  const headers = {
    Host: "www.googleapis.com",
    Authorization: `Bearer ${token}`,
    "X-Upload-Content-Type": "message/rfc822"
  };
  const axios = require("axios");
  axios
    .request("https://googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=resumable", {
      method: "POST",
      headers: {
        ...headers
      }
    })
    .then(res => {
      return res.headers.location;
    })
    .then(location => {
      global.logger.info("Starting uploading message data...");
      axios
        .request(location, {
          method: "PUT",
          headers: {
            "Content-Length": `${Buffer.byteLength(preparedMessage)}`,
            "Content-Type": "message/rfc822"
          },
          data: preparedMessage,
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        })
        .then(res => {
          global.logger.info("Done uploading");
          return res;
        })
        .catch(err => {
          global.logger.info("Couldn't message");
          global.logger.toStackTrace(err.response);
          return err;
        });
    })
    .catch(err => {
      global.logger.info("Couldn't start messaging");
      global.logger.toStackTrace(err.response);
      return err;
    });
}

module.exports.sendMessage = sendMessage;
module.exports.getMessageAuthor = getMessageAuthor;
module.exports.getMessageData = getMessageData;
