const productPath = '/product'
const { createPayment, executePayment, retrievePayment } = require('../utils/product')

module.exports = async function (app, db) {
  app.post(`${productPath}/create-payment`, (req, res) => {
    createPayment(req, res)
  })
  app.post(`${productPath}/execute-payment`, (req, res) => {
    executePayment(req, res)
  }),
  app.get(`${productPath}/retrieve-payment/:paymentId/:payerId`, (req, res) => {
    retrievePayment(req, res)
  })
}
