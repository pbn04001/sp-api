const productPath = '/product'
const { completePurchase, createPayment, executePayment } = require('../data/product')




module.exports = async function (app, db) {
  app.post(`${productPath}/complete-purchase`, (req, res) => {
    completePurchase(req, res)
  })
  app.post(`${productPath}/create-payment`, (req, res) => {
    createPayment(req, res)
  })
  app.post(`${productPath}/execute-payment`, (req, res) => {
    executePayment(req, res)
  })
}
