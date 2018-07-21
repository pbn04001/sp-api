const productPath = '/product'
const { createPayment, executePayment } = require('../utils/product')

module.exports = async function (app, db) {
  app.post(`${productPath}/create-payment`, (req, res) => {
    createPayment(req, res)
  })
  app.post(`${productPath}/execute-payment`, (req, res) => {
    executePayment(req, res)
  })
}
