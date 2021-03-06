const fs = require("fs");
const { google } = require("googleapis");
const path = require("path");
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
        return userData.match(/^(<|.)(.+)@.+(>|.)$/gi);
      })
      .replace(/<|>/g, "");

    return {
      email: email,
      firstName: author[0] && author[0].includes(email) ? "" : author[1],
      lastName: author[1] && author[1].includes(email) ? "" : author[1]
    };
  });
}

module.exports.isProvider = function isProvider(gmail, msg, providers) {
  return getMessageAuthor(gmail, msg).then(author => {
    return providers.some(provider => provider.email === author.email);
  });
};

module.exports.isSubscriber = function isSubscriber(gmail, msg, subscribers) {
  return getMessageAuthor(gmail, msg).then(author => {
    return subscribers.some(subscriber => subscriber.email === author.email);
  });
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
/**
 * @param {google.auth.OAuth2} oAuth2Client
 * @returns {Promise} returns a Promise which will send an information who has messaged a token
 */
module.exports.checkForTokens = function checkForTokens(auth) {
  const gmail = google.gmail({ version: "v1", auth });
  return new Promise((resolve, reject) => {
    global.logger.info("Searching for tokens");
    messageProvider.getUnreadMessages(gmail).then(response => {
      const { data } = response;
      if (data.messages) {
        resolve(data);
      } else {
        reject(`There was no new messages\nDone searching`);
      }
    });
  })
    .then(async data => {
      const config = JSON.parse(fs.readFileSync("./config/config.json"));
      const { PROVIDER_TOKEN, SUBSCRIBER_TOKEN, UNSUBSCRIBE_TOKEN, NONPROVIDING_TOKEN, host } = config;
      const accessToken = auth.credentials.access_token;
      //Looking through every unread message
      for (const msg of data.messages) {
        const currentMsg = await messageProvider.getMessageData(gmail, msg);
        const author = await messageProvider.getMessageAuthor(gmail, msg);
        let hasTokens = false;
        if (hasToken(currentMsg, PROVIDER_TOKEN)) {
          if (!config.providers.some(provs => provs.email === author.email)) {
            config.providers.push(author);
            writeDataSyncIntoConfig(gmail, currentMsg, config, "add provider");
            hasTokens = true;
            const headers = [`To: ${author.email}`, `From: ${host.email}`, `Subject: Information`];
            const body = [
              `Content-Type: text/html; charset="UTF-8"`,
              ``,
              `This is autogenerated message. Do not respond!`,
              ``,
              `<div style="font-family:'Times New Roman', Times, serif; font-size: 14px;">`,
              `<p>Привет! Если вы видите это сообщение и ничего не отправляли на эту почту, то проигнорируйте.</p>`,
              `<br>`,
              `<p>Информация для провайдеров: Так как вы являетесь провайдером вы будете отправлять все сообщения подписчикам. Таким образом не отправляйте на эту почту личную информацию</p>`,
              `<p>Для того, чтобы перестать быть провайдером нужно прислать этот код</p>`,
              `<strong>${NONPROVIDING_TOKEN}</strong>`,
              `</div>`,
              `<br>`,
              `--Sincerely Ivan Sadykov`
            ];
            const message = { body, headers };
            messageProvider.sendMessage(message, accessToken);
          }
        }
        if (hasToken(currentMsg, SUBSCRIBER_TOKEN)) {
          if (!config.subscribers.some(subs => subs.email === author.email)) {
            config.subscribers.push(author);
            writeDataSyncIntoConfig(gmail, currentMsg, config, "add subscriber");
            hasTokens = true;
            const headers = [`To: ${author.email}`, `From: ${host.email}`, `Subject: Information`];
            const body = [
              `Content-Type: text/html; charset="UTF-8"`,
              ``,
              `This is autogenerated message. Do not respond!`,
              ``,
              `<div style="font-family:'Times New Roman', Times, serif; font-size: 14px;">`,
              `<p>Привет! Если вы видите это сообщение и ничего не отправляли на эту почту, то проигнорируйте.</p>`,
              `<br>`,
              `<p>Информация для подписчиков: Вам будут отправляться все сообщения от провайдеров, которые они отправляют сюда.</p>`,
              `<p>Для того, чтобы отписаться нужно прислать этот код</p>`,
              `<strong>${UNSUBSCRIBE_TOKEN}</strong>`,
              `</div>`,
              `<br>`,
              `--Sincerely Ivan Sadykov`
            ];
            const message = { body, headers };
            messageProvider.sendMessage(message, accessToken);
          }
        }
        if (hasToken(currentMsg, UNSUBSCRIBE_TOKEN)) {
          const id = config.subscribers.findIndex(sub => sub.email === author.email);
          config.subscribers.splice(id, 1);
          writeDataSyncIntoConfig(gmail, currentMsg, config, "delete subscriber");
          const headers = [`To: ${author.email}`, `From: ${host.email}`];
          const body = [
            `Content-Type: text/plain; charset="UTF-8"`,
            ``,
            `This is autogenerated message. Do not respond!`,
            ``,
            `Вы успешно отписались от рассылки`,
            ``,
            `--Sincerely Ivan Sadykov`
          ];
          const message = { body, headers };
          messageProvider.sendMessage(message, accessToken);
          hasTokens = true;
        }
        if (hasToken(currentMsg, NONPROVIDING_TOKEN)) {
          const id = config.providers.findIndex(provider => provider.email === author.email);
          config.providers.splice(id, 1);
          writeDataSyncIntoConfig(gmail, currentMsg, config, "delete provider");
          const headers = [`To: ${author.email}`, `From: ${host.email}`];
          const body = [
            `Content-Type: text/plain; charset="UTF-8"`,
            ``,
            `This is autogenerated message. Do not respond!`,
            ``,
            `Вы больше не провайдер`,
            ``,
            `--Sincerely Ivan Sadykov`
          ];
          const message = { body, headers };
          messageProvider.sendMessage(message, accessToken);
          hasTokens = true;
        }
        if (!hasTokens) {
          global.logger.info(`Couldn't find any tokens`);
        } else {
          labelModifier.removeLabels(gmail, currentMsg.data, ["UNREAD"]);
        }
      }
    })
    .then(() => {
      return `Done searching for tokens`;
    })
    .catch(err => {
      global.logger.error(err);
      return err;
    });
};

function writeDataSyncIntoConfig(gmail, msg, data, overwritingInfo) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(data, null, 4));
  } catch (err) {
    global.logger.error(err);
  } finally {
    global.logger.info(`Overwriting existing config with ${overwritingInfo}`);
    labelModifier.removeLabels(gmail, msg.data, ["UNREAD"]);
  }
}

/**
 *
 * @param {Object} message contains message.headers and message.body
 * @param {String} token auth token
 * @description Sending message via resumable protocol on gmail api
 */
async function sendMessage(message, token) {
  const preparedMessage = message.headers.concat(message.body).join("\n");
  const headers = {
    Host: "www.googleapis.com",
    Authorization: `Bearer ${token}`,
    "X-Upload-Content-Type": "message/rfc822"
  };
  const axios = require("axios");
  setTimeout(() => {
    global.logger.info(`Starting http requests`);
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
        setTimeout(() => {
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
              setTimeout(() => {
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
                    global.logger.toStackTrace(err.response);
                    global.logger.err("Couldn't message stopped trying");
                  });
              }, 2000);
            });
        }, 2 * 1000);
      })
      .catch(err => {
        global.logger.toStackTrace(err.response);
        global.logger.err("Couldn't start messaging");
        return err;
      });
  }, 2 * 1000);
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
