const fs = require("fs");
const { providers } = JSON.parse(fs.readFileSync("./config/config.json"));

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
    return {
      email: author[2].replace(/<|>/g, ""),
      firstName: author[0].replace(/"/g, '"'),
      lastName: author[1].replace(/"/g, '"')
    };
  });
}

module.exports.isProvider = async function isProvider(gmail, msg) {
  const author = await getMessageAuthor(gmail, msg);

  return providers.some(provider => provider.email === author.email);
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

module.exports.getMessageAuthor = getMessageAuthor;
module.exports.getMessageData = getMessageData;
