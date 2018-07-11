const { PayPayService, DrupalService } = require('../services')
const productPath = '/product'
const constants = require('../constants')

const throwError = (type, error) => {
  const newError = new Error(error)
  newError.type = type
  throw newError
}

async function getPaypalPayment(paymentId) {
  try {
    const token = await PayPayService.getAuthorizationToken()
    const paypalPayment = await PayPayService.getPaymentDetails({
      accessToken: token.accessToken,
      paymentId: paymentId,
    })
    return paypalPayment
  } catch (error) {
    console.log(error)
    throwError(constants.ERROR_TYPES.PAY_PAL_GET_PAYMENT_FAILED, error)
  }
}

async function getDrupalNodes(paypalPayment) {
  let purchaseTotal = 0
  let drupalItemsTotal = 0
  let drupalNodes = []
  try {
    const items = paypalPayment.transactions[0].item_list.items
    drupalNodes = await Promise.all(items.map(item => {
      purchaseTotal += (parseFloat(item.price) * item.quantity)
      return DrupalService.getNode(item.sku)
          .then(node => {
            node.purchasedQuantity = item.quantity
            return node
          })
    }))
  } catch (error) {
    console.log(error)
    throwError(constants.ERROR_TYPES.DRUPAL_GET_NODES_FAILED, error)
  }
  drupalNodes.forEach(node => {
    if (node.quantity < node.purchasedQuantity) {
      // TODO: cancel paypal payment
       throwError(constants.ERROR_TYPES.PURCHASED_ITEMS_NO_LONGER_AVAILABLE)
    }
    drupalItemsTotal += node.price * node.purchasedQuantity
  })
  if (purchaseTotal !== drupalItemsTotal) {
    // TODO: cancel paypal payment
    throwError( constants.ERROR_TYPES.PAY_PAL_NOT_MATCHING_DRUPAL)
  }
  return drupalNodes
}

async function updateDrupalNodes(drupalNodes) {
  try {
     const results = await Promise.all(drupalNodes.map(node => {
       return DrupalService.updateNodeQuantity(node)
     }))
    return results
  } catch (error) {
    // TODO: send notification to Admin so they can manually fix drupal quantities
    console.log(error)
    throwError(constants.ERROR_TYPES.DRUPAL_UPDATE_NODES_FAILED, error)
  }
}

async function completePurchase(req, res) {
  try {
    const values = req.body
    const paypalPayment = await getPaypalPayment(values.paymentId)
    const drupalNodes = await getDrupalNodes(paypalPayment)
    const results = await updateDrupalNodes(drupalNodes)
    res.statusCode = 200
    return res.json({ success: true })
  } catch(error) {
    res.statusCode = 500
    if (!!error.type) {
      return res.json(error)
    }
    console.log(error)
    return res.json({ type: constants.ERROR_TYPES.UNEXPECTED_ERROR, error })
  }
}

module.exports = async function (app, db) {
  app.post(`${productPath}/complete-purchase`, (req, res) => {
    completePurchase(req, res)
  })
}
