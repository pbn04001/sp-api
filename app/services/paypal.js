const request = require('request-promise')
const moment = require('moment')
const config = require('../../config/index')

module.exports = {
  getAuthorizationToken: () => {
    const auth = Buffer.from(config.clientId + ":" + config.secret).toString("base64")
    return request({
      uri: 'https://api.sandbox.paypal.com/v1/oauth2/token',
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
        .then(response => {
          return {
            accessToken: response.access_token,
            expires: moment().add(response.expires_in, 'seconds')
          }
        }).catch(error => ({ error }))
  },
  getPaymentDetails: ({ accessToken, paymentId }) => {
    return request({
      url: `https://api.sandbox.paypal.com/v1/payments/payment/${paymentId}`,
      method: 'GET',
      json: true,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    }).then(response => {
      debugger;
      console.log(response)
    }).catch(error => ({ error }))
  }
}
