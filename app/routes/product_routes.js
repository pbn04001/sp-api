const { PayPayService } = require('../services')
const request = require('request');
const productPath = '/product'

module.exports = function(app, db) {
  app.post(`${productPath}/purchased`, (req, res) => {
    const values = req.body

    PayPayService.getAuthorizationToken()


  });
};
