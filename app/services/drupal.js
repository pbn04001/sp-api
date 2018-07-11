const request = require('request-promise')
const config = require('../../config/index')

module.exports = {
  getNode: (nodeId) => {
    return request({
      uri: `${config.drupal_endpoint}/node/${nodeId}?_format=json`,
      method: 'GET',
      json: true,
      headers: {
        'Content-Type': 'application/json',
      }
    }).then(response => ({
      ...response,
      price: parseFloat(response.field_price[0].value),
      quantity: parseInt(response.field_quantity[0].value),
    }))
  },
  updateNodeQuantity: (node) => {
    const nodeId = node.nid[0].value
    const updatedQuantity = node.quantity - node.purchasedQuantity
    const auth = Buffer.from(config.drupal_admin.username + ":" + config.drupal_admin.password).toString("base64")
    return request({
      uri: `${config.drupal_endpoint}/node/${nodeId}?_format=json`,
      method: 'PATCH',
      json: {
        nid: [{ value: nodeId }],
        type: [{ target_id: "products" }],
        field_quantity: [{ value: updatedQuantity }]
      },
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      }
    })
  },
}
