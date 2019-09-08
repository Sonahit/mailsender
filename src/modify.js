const attchProvider = require("./attachments");

module.exports.removeLabels = function removeLabels(gmail, msgData, labels = []) {
  return gmail.users.messages
    .modify({
      userId: "me",
      id: msgData.id,
      resource: {
        addLabelIds: [],
        removeLabelIds: labels
      }
    })
    .then(msg => {
      global.logger.info(`Modified message ${msg.data.id}`);
      return msg;
    })
    .catch(err => {
      global.logger.info("Couldn't modify message");
      global.logger.error(err);
    });
};

/**
 * @param {Object} gmail Google gmail client
 * @param {Object} data Message body to copy
 * @returns {Promise} copied message body
 * @description Copies message body according to RFC822
 */
module.exports.prepareMessageBody = function prepareMessageBody(gmail, data) {
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
    messageBody.push("");
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
      resolved.messageBody.push(`--${resolved.boundary}--`);
      return resolved.messageBody;
    })
    .then(resolved => {
      return resolved;
    });
};

/**
 * @param {Object} gmail Google gmail client
 * @param {Object} origin headers
 * @param {Object} user for "To: ${user.email}" header
 * @param {Object} host for "From: ${host.email}" header
 * @returns copied headers from origin headers but less and with appropriate To: From:
 */
module.exports.prepareMessageHeaders = function prepareMessageHeaders(origin, user, host) {
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
  headers.push(`${subject.name}: Do not respond! ${subject.value}`);
  if (references) {
    headers.push(`${references.name}: ${references.value}`);
  }
  headers.push(`${contentType.name}: ${contentType.value}`);
  return headers;
};

/**
 *
 * @param {Object} gmail Google gmail client
 * @param {Array} messageBody preparing MIME message body
 * @param {Object} attachments The message body that contains non-text attachments
 * @param {Number} messageId Id of incoming message
 * @returns {Array} copied MIME appropriate scheme for attachments
 */
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
