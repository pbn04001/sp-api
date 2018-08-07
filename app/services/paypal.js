const request = require('request-promise')
const moment = require('moment')
const config = require('../../config/index')

module.exports = {
  getAuthorizationToken: () => {
    const auth = Buffer.from(config.clientId + ":" + config.secret).toString("base64")
    return request({
      uri: `${config.paypal_endpoint}/v1/oauth2/token`,
      method: 'POST',
      json: true,
      form: {
        grant_type: 'client_credentials'
      },
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en_US',
        'Authorization': `Basic ${auth}`
      }
    })
        .then(function (response) {
          return {
            accessToken: response.access_token,
            expires: moment().add(response.expires_in, 'seconds')
          }
        })
  },
  getPaymentDetails: ({ accessToken, paymentId }) => {
    return request({
      url: `${config.paypal_endpoint}/v1/payments/payment/${paymentId}`,
      method: 'GET',
      json: true,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    })
  },
  refundPaypalPayment: (accessToken, paypalPayment) => {
    const links = paypalPayment.transactions[0].related_resources[0].sale.links
    const refundLink = links.find(link => link.rel === 'refund')
    return request({
      url: refundLink.href,
      method: 'POST',
      json: {},
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    })
  },
  createPaypalPayment: (items, total) => {
    return request.post(`${config.paypal_endpoint}/v1/payments/payment`, {
      auth: {
        user: config.clientId,
        pass: config.secret,
      },
      body: {
        intent: 'sale',
        payer: {
          payment_method: 'paypal'
        },
        transactions: [{
          amount: {
            total: total,
            currency: 'USD'
          },
          item_list: {
            items,
          }
        }],
        redirect_urls: {
          return_url: config.paypal_redirect.return_url,
          cancel_url: config.paypal_redirect.cancel_url,
        }
      },
      json: true
    })
  },
  executePaypalPayment: (paymentId, payerId, total) => {
    return request.post(`${config.paypal_endpoint}/v1/payments/payment/${paymentId}/execute`, {
      auth: {
        user: config.clientId,
        pass: config.secret,
      },
      body: {
        payer_id: payerId,
        transactions: [{
          amount: {
            total: total,
            currency: 'USD'
          }
        }]
      },
      json: true
    })
  }
}
