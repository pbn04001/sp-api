const contactPath = '/contact'
const { sendMessage } = require('../utils/contact')

module.exports = async function (app, db) {
  app.post(`${contactPath}/send-message`, (req, res) => {
    sendMessage(req, res)
  })
}
