const fs = require("fs");
const { google } = require("googleapis");
const path = require("path");
const config = JSON.parse(fs.readFileSync("./config/config.json"));
const { providers, subscribers, PROVIDER_TOKEN, SUBSCRIBER_TOKEN, UNSUBSCRIBE_TOKEN, NONPROVIDING_TOKEN } = config;
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
  const gmail = google.gmail({ version: "v1", auth });
  return new Promise(resolve => {
    global.logger.info("Searching for tokens");
    messageProvider.getUnreadMessages(gmail).then(response => {
      const { data } = response;
      if (data.messages) {
        resolve(data);
      } else {
        global.logger.info(`There was no new messages.`);
      }
    });
  })
    .then(async data => {
      for (const msg of data.messages) {
        const currentMsg = await messageProvider.getMessageData(gmail, msg);
        const author = await messageProvider.getMessageAuthor(gmail, msg);
        let hasTokens = false;
        if (hasToken(currentMsg, PROVIDER_TOKEN)) {
          if (!config.providers.some(provs => provs.email === author.email)) {
            config.providers.push(author);
            writeDataSyncIntoConfig(gmail, currentMsg, config, "add provider");
            hasTokens = true;
          }
        }
        if (hasToken(currentMsg, SUBSCRIBER_TOKEN)) {
          if (!config.subscribers.some(subs => subs.email === author.email)) {
            config.subscribers.push(author);
            writeDataSyncIntoConfig(gmail, currentMsg, config, "add subscriber");
            hasTokens = true;
          }
        }
        if (hasToken(currentMsg, UNSUBSCRIBE_TOKEN)) {
          const id = config.subscribers.findIndex(sub => sub.email === author.email);
          config.subscribers.splice(id, 1);
          writeDataSyncIntoConfig(gmail, currentMsg, config, "delete subscriber");
          hasTokens = true;
        }
        if (hasToken(currentMsg, NONPROVIDING_TOKEN)) {
          const id = config.providers.findIndex(provider => provider.email === author.email);
          config.providers.splice(id, 1);
          writeDataSyncIntoConfig(gmail, currentMsg, config, "delete provider");
          hasTokens = true;
        }
        if (!hasTokens) {
          global.logger.info(`Couldn't find any tokens`);
        }
      }
    })
    .then(() => {
      const message = `Done searching for tokens`;
      return message;
    });
};

function writeDataSyncIntoConfig(gmail, msg, data, overwritingInfo) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
  } catch (err) {
    global.logger.info(err);
  } finally {
    global.logger.info(`Overwriting existing config with ${overwritingInfo}`);
    labelModifier.removeLabels(gmail, msg.data, ["UNREAD"]);
  }
}
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
      global.logger.info(`Starting uploading message data ${message.headers[0]}`);
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
          global.logger.info("Trying to send message again");
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
              global.logger.info("Couldn't message stopped trying");
              global.logger.toStackTrace(err.response);
            });
        });
    })
    .catch(err => {
      global.logger.info("Couldn't start messaging");
      global.logger.toStackTrace(err.response);
      return err;
    });
}

function trashMessage(gmail, msg) {
  const options = {
    userId: "me",
    id: msg.id
  };
  gmail.users.messages
    .trash(options)
    .then(() => {
      global.logger.info(`Successfully trashed message ${msg.id}`);
    })
    .catch(err => {
      global.logger.error(`Couldn't trashed message ${msg.id}`);
      global.logger.toStackTrace(err);
    });
}

module.exports.trashMessage = trashMessage;
module.exports.sendMessage = sendMessage;
module.exports.getMessageAuthor = getMessageAuthor;
module.exports.getMessageData = getMessageData;
