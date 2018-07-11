const { PayPayService, DrupalService } = require('../services')
const productPath = '/product'
const constants = require('../constants')
const { handleCriticalError } = require('../utils/error')

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
    return {
      payment: paypalPayment,
      accessToken: token.accessToken,
    }
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
    const items = paypalPayment.payment.transactions[0].item_list.items
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
       try {
         PayPayService.refundPaypalPayment(paypalPayment.accessToken, paypalPayment.payment)
         throwError(constants.ERROR_TYPES.PURCHASED_ITEMS_NO_LONGER_AVAILABLE)
       } catch(error) {
         handleCriticalError(`Unable to refund money for ${paypalPayment.payment.paymentId}`,
             'Item was out of stock, so a refund was attempted and failed.\n' +
             'Please manually refund this users payment\n' +
             JSON.stringify(paypalPayment.payment))
         throwError(constants.ERROR_TYPES.PAY_PAL_UNABLE_TO_REFUND)
       }
    }
    drupalItemsTotal += node.price * node.purchasedQuantity
  })
  if (purchaseTotal !== drupalItemsTotal) {
    try {
      PayPayService.refundPaypalPayment(paypalPayment.accessToken, paypalPayment.payment)
      throwError( constants.ERROR_TYPES.PAY_PAL_NOT_MATCHING_DRUPAL)
    } catch(error) {
      handleCriticalError(`Unable to refund money for ${paypalPayment.payment.paymentId}`,
          'Items purchased prices do not match drupal items, so a refund was attempted and failed.\n' +
          'Please manually refund this users payment\n' +
          JSON.stringify(paypalPayment.payment))
      throwError(constants.ERROR_TYPES.PAY_PAL_UNABLE_TO_REFUND)
    }
  }
  return drupalNodes
}

async function updateDrupalNodes(paypalInfo, drupalNodes) {
  try {
     const results = await Promise.all(drupalNodes.map(node => {
       return DrupalService.updateNodeQuantity(node)
     }))
    return results
  } catch (error) {
    handleCriticalError(`Error occurred updating drupal for purchase ${paypalInfo.paymentId}`, paypalInfo)
    console.log(error)
    throwError(constants.ERROR_TYPES.DRUPAL_UPDATE_NODES_FAILED, error)
  }
}

async function completePurchase(req, res) {
  try {
    const values = req.body
    const paypalPayment = await getPaypalPayment(values.paymentId)
    const drupalNodes = await getDrupalNodes(paypalPayment)
    const results = await updateDrupalNodes(values, drupalNodes)
    res.statusCode = 200
    return res.json({ success: true, results })
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
