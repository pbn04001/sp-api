const { PayPayService, DrupalService } = require('../services')
const constants = require('../constants')
const { handleCriticalError } = require('../utils/error')

const throwError = (type, error) => {
  const newError = new Error(error)
  newError.type = type
  throw newError
}

/* async function getPaypalPayment(paymentId) {
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
    handleCriticalError(`Unable to retrieve payment info from paypal ${paymentId}`,
        'Please reach out to customer to either refund or manually process order')
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
    try {
      PayPayService.refundPaypalPayment(paypalPayment.accessToken, paypalPayment.payment)
      throwError(constants.ERROR_TYPES.DRUPAL_GET_NODES_FAILED, error)
    } catch (error) {
      handleCriticalError(`Unable to refund money for ${paypalPayment.payment.paymentId}`,
          'Issue occurred while trying to update drupal, so a refund was attempted and failed.\n' +
          'Please reach out to customer to either refund or manually process order.\n' +
          JSON.stringify(paypalPayment.payment))
      throwError(constants.ERROR_TYPES.PAY_PAL_UNABLE_TO_REFUND)
    }
  }
  drupalNodes.forEach(node => {
    if (node.quantity < node.purchasedQuantity) {
      try {
        PayPayService.refundPaypalPayment(paypalPayment.accessToken, paypalPayment.payment)
        throwError(constants.ERROR_TYPES.PURCHASED_ITEMS_NO_LONGER_AVAILABLE)
      } catch (error) {
        handleCriticalError(`Unable to refund money for ${paypalPayment.payment.paymentId}`,
            'Item was out of stock, so a refund was attempted and failed.\n' +
            'Please reach out to customer to either refund or manually process order.\n' +
            JSON.stringify(paypalPayment.payment))
        throwError(constants.ERROR_TYPES.PAY_PAL_UNABLE_TO_REFUND)
      }
    }
    drupalItemsTotal += node.price * node.purchasedQuantity
  })
  if (purchaseTotal !== drupalItemsTotal) {
    try {
      PayPayService.refundPaypalPayment(paypalPayment.accessToken, paypalPayment.payment)
      throwError(constants.ERROR_TYPES.PAY_PAL_NOT_MATCHING_DRUPAL)
    } catch (error) {
      handleCriticalError(`Unable to refund money for ${paypalPayment.payment.paymentId}`,
          'Items purchased prices do not match drupal items, so a refund was attempted and failed.\n' +
          'Please reach out to customer to either refund or manually process order.\n' +
          JSON.stringify(paypalPayment.payment))
      throwError(constants.ERROR_TYPES.PAY_PAL_UNABLE_TO_REFUND)
    }
  }
  return drupalNodes
}

async function updateDrupalNodes(paypalInfo, drupalNodes, paypalPayment) {
  try {
    const results = await Promise.all(drupalNodes.map(node => {
      return DrupalService.updateNodeQuantity(node)
    }))
    return results
  } catch (error) {
    handleCriticalError(`Error occurred updating drupal for purchase ${paypalInfo.paymentId}`,
        'Payment was successful, but was unable to update drupal product quantities.' +
        'Please manually go in and update these products.\n' +
        JSON.stringify(paypalPayment.payment))

    console.log(error)
    throwError(constants.ERROR_TYPES.DRUPAL_UPDATE_NODES_FAILED, error)
  }
}*/

async function verifyDrupalProducts(items, total) {
  let purchaseTotal = 0
  let products = []
  try {
    products = await Promise.all(items.map(item => {
      return DrupalService.getNode(item.sku)
          .then(product => {
            purchaseTotal += (parseFloat(product.price) * item.quantity)
            return {
              ...product,
              quantity: item.quantity,
            }
          })
    }))
  } catch (error) {
    console.log(error)
    handleCriticalError(`Unable to get drupal nodes`,
        JSON.stringify(error))
    throwError(constants.ERROR_TYPES.DRUPAL_GET_NODES_FAILED, error)
  }
  products.forEach(node => {
    if (node.stock < node.quantity) {
      throwError(constants.ERROR_TYPES.PURCHASED_ITEMS_NO_LONGER_AVAILABLE)
    }
  })
  if (purchaseTotal !== total) {
    throwError(constants.ERROR_TYPES.PAY_PAL_NOT_MATCHING_DRUPAL)
  }
}

async function createPaypalPayment(items, total) {
  try {
    const paypalPayment = await PayPayService.createPaypalPayment(items, total)
    return paypalPayment
  } catch (error) {
    console.log(error)
    handleCriticalError(`Unable to create paypal payment`,
        JSON.stringify(error))
    throwError(constants.ERROR_TYPES.UNABLE_TO_CREATE_PAYPAL_PAYMENT, error)
  }
}

module.exports = {
  createPayment: async function (req, res) {
    try {
      const { items, total } = req.body
      await verifyDrupalProducts(items, total)
      const response = await createPaypalPayment(items, total)
      res.statusCode = 200
      res.json({
        id: response.id
      });
    } catch (error) {
      res.statusCode = 500
      if (!!error.type) {
        return res.json(error)
      }
      console.log(error)
      handleCriticalError(`Unexpected error occurred!!`, 'Unexpected Error:\n' + JSON.stringify(error) +
          'Failed to create payment with paypal.')
      return res.json({ type: constants.ERROR_TYPES.UNEXPECTED_ERROR, error })
    }
  },
  completePurchase: async function (req, res) {
    /*let paypalPayment
    try {
      const values = req.body
      paypalPayment = await getPaypalPayment(values.paymentId)
      const drupalNodes = await getDrupalNodes(paypalPayment)
      const results = await updateDrupalNodes(values, drupalNodes, paypalPayment)
      res.statusCode = 200
      return res.json({ success: true, results })
    } catch (error) {
      res.statusCode = 500
      if (!!error.type) {
        return res.json(error)
      }
      console.log(error)
      let body = 'Unexpected Error:\n' + JSON.stringify(error) +
          'Please reach out to customer to either refund or manually process order.\n'
      if (paypalPayment) {
        body += JSON.stringify(paypalPayment.payment)
      }
      handleCriticalError(`Unexpected error occurred!!`, body)
      return res.json({ type: constants.ERROR_TYPES.UNEXPECTED_ERROR, error })
    }*/
  },
  executePayment: async function (req, res) {

  }
}
