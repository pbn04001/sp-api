const { PayPayService } = require('../services')
const productPath = '/product'

module.exports = function(app, db) {
  app.post(`${productPath}/complete-purchase`, (req, res) => {
    const values = req.body
    PayPayService.getAuthorizationToken()
        .then(token => {
          PayPayService.getPaymentDetails({
            accessToken: token.accessToken,
            paymentId: values.paymentId
          }).then(results => {
            console.log(results)
          })
        })
        .catch(error => {
          console.log(error)
        })
  });
};
