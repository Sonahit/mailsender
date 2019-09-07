const fs = require("fs");
const { google } = require("googleapis");
const config = JSON.parse(fs.readFileSync("./config/config.json"));
const { subscribers, host } = config;
const hasToken = require("./authorize").hasToken;
const labelModifier = require("./modify");
const attchProvider = require("./attachments");
const messageProvider = require("./message.js");

module.exports.mailMessagesToSubscribers = function mailMessagesToSubscribers(auth) {
  const gmail = google.gmail({ version: "v1", auth });
  return new Promise(resolve => {
    global.logger.info("Searching for unread messages");
    messageProvider.getUnreadMessages(gmail).then(response => {
      const { data } = response;
      if (data.messages) {
        resolve(data);
      } else {
        global.logger.info("There was no new messages");
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
            const messageBody = await prepareMessageBody(gmail, data);
            if (!process.env.DEBUG_LOGGER) {
              subscribers.forEach(sub => {
                const messageHeaders = prepareMessageHeaders(data.payload.headers, sub, host);
                const message = {
                  body: messageBody,
                  headers: messageHeaders
                };
                messageProvider.sendMessage(message, accessToken);
              });
            } else {
              global.logger.info("DEBUG");
              const user = { firstName: "Иван", lastName: "Садыков", email: "grandpajok@gmail.com" };
              const messageHeaders = prepareMessageHeaders(data.payload.headers, user, host);
              const message = {
                body: messageBody,
                headers: messageHeaders
              };
              messageProvider.sendMessage(message, accessToken);
            }
            labelModifier.removeLabels(gmail, data, ["UNREAD"]);
          } else {
            labelModifier.removeLabels(gmail, currentMsg.data, ["UNREAD"]);
            messageProvider.trashMessage(gmail, msg);
          }
        }
      }
    })
    .then(() => {
      const message = "Done messaging";
      return message;
    });
};

function prepareMessageBody(gmail, data) {
  return new Promise(resolve => {
    const messageBody = [];
    const boundary = data.payload.headers
      .find(header => header.name === "Content-Type")
      .value.split(";")[1]
      .trim()
      .split("boundary=")[1]
      .replace(/["]/g, "");
    const attchMsgs = [];
    const attchsMedia = [];
    messageBody.push(`--${boundary}`);
    messageBody.push(`Content-Type: text/plain; charset="UTF-8"`);
    messageBody.push(`Content-Transfer-Encoding: base64`);
    messageBody.push("This is autogenerated message. Do not respond!");
    messageBody.push("");
    messageBody.push(`--${boundary}`);
    for (const attachment of data.payload.parts) {
      const mimes = attachment.headers;
      if (!attachment.mimeType.includes("text")) {
        mimes.forEach(mime => {
          if (attachment.mimeType.includes("multipart")) {
            messageBody.push(`${mime.name}: ${mime.value}`);
            getSchema(gmail, messageBody, attachment, data.id);
          }
        });
        if (attachment.body.attachmentId) {
          attchsMedia.push(attachment);
        }
      } else {
        attchMsgs.push(attachment);
      }
    }
    resolve({
      attchsMedia,
      attchMsgs,
      messageBody,
      boundary
    });
  })
    .then(async resolved => {
      for (const attachment of resolved.attchsMedia) {
        const mimes = attachment.headers;
        let once = 0;
        mimes.forEach(mime => {
          if (once === 0 && attachment.body.attachmentId) {
            resolved.messageBody.push(`--${resolved.boundary}`);
            once++;
          }
          resolved.messageBody.push(`${mime.name}: ${mime.value}`);
        });
        const resp = await attchProvider.getAttachmentData(gmail, data.id, attachment.body.attachmentId);
        const fs = require("fs");
        const tempFile = "./src/temp";
        fs.writeFileSync(tempFile, Buffer.from(resp.data.data, "base64"));
        resolved.messageBody.push("");
        resolved.messageBody.push(fs.readFileSync(tempFile, { encoding: "base64" }));
        fs.unlinkSync(tempFile);
      }
      return resolved;
    })
    .then(resolved => {
      resolved.attchMsgs.forEach(message => {
        resolved.messageBody.push("");
        resolved.messageBody.push(`--${resolved.boundary}`);
        attchProvider.appendTextAttachment(resolved.messageBody, message);
      });
      resolved.messageBody.push("");
      resolved.messageBody.push(`--${resolved.boundary}--`);
      return resolved.messageBody;
    })
    .then(resolved => {
      return resolved;
    });
}

function prepareMessageHeaders(origin, user, host) {
  const headers = [];
  origin[origin.findIndex(header => header.name === "To")] = {
    name: "To",
    value: `${user.firstName} ${user.lastName} <${user.email}>`
  };

  origin[origin.findIndex(header => header.name === "From")] = {
    name: "From",
    value: `<${host.email}>`
  };
  const to = origin.find(header => header.name === "To");
  const from = origin.find(header => header.name === "From");
  const mime = origin.find(header => header.name === "MIME-Version");
  const messageId = origin.find(header => header.name === "Message-ID");
  const subject = origin.find(header => header.name === "Subject");
  const contentType = origin.find(header => header.name === "Content-Type");
  const references = origin.find(header => header.name === "References");
  headers.push(`${to.name}: ${to.value}`);
  headers.push(`${from.name}: ${from.value}`);
  headers.push(`${mime.name}: ${mime.value}`);
  headers.push(`${messageId.name}: ${messageId.value}`);
  headers.push(`${subject.name}: ${subject.value}`);
  if (references) {
    headers.push(`${references.name}: ${references.value}`);
  }
  headers.push(`${contentType.name}: ${contentType.value}`);
  return headers;
}

async function getSchema(gmail, messageBody, attachments, messageId) {
  const mimes = attachments.headers;
  const boundary = attachments.headers
    .find(header => header.name === "Content-Type")
    .value.split(";")[1]
    .trim()
    .split("boundary=")[1]
    .replace(/["]/g, "");
  let attchMsgs = [];
  for (const attachment of attachments.parts) {
    if (!attachment.mimeType.includes("text")) {
      let once = 0;
      mimes.forEach(mime => {
        if (attachment.mimeType.includes("multipart")) {
          messageBody.push(`${mime.name}: ${mime.value}`);
          getSchema(gmail, messageBody, attachment, messageId);
        } else {
          if (once === 0 && attachment.body.attachmentId) {
            messageBody.push(`--${boundary}`);
            once++;
          }
          messageBody.push(`${mime.name}: ${mime.value}`);
        }
      });
      if (attachment.body.attachmentId) {
        const resp = await attchProvider.getAttachmentData(gmail, messageId, attachment.body.attachmentId);
        const fs = require("fs");
        const tempFile = "./src/temp";
        fs.writeFileSync(tempFile, Buffer.from(resp.data.data, "base64"));
        messageBody.push("");
        messageBody.push(fs.readFileSync(tempFile, { encoding: "base64" }));
        fs.unlinkSync(tempFile);
      }
    } else {
      attchMsgs.push(attachment);
    }
  }
  attchMsgs.forEach(message => {
    messageBody.push("");
    messageBody.push(`--${boundary}`);
    attchProvider.appendTextAttachment(messageBody, message);
  });
  messageBody.push("");
  messageBody.push(`--${boundary}--`);
  messageBody.push("");
}

module.exports.getSchema = getSchema;
