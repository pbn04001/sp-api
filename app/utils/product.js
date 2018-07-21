const { PayPayService, DrupalService } = require('../services')
const constants = require('../constants')
const { handleCriticalError } = require('../utils/error')

const throwError = (type, error, extra = {}) => {
  const newError = new Error(error)
  newError.type = type
  throw {
    ...newError,
    ...extra
  }
}

async function verifyDrupalProducts(items, total) {
  let purchaseTotal = 0
  let drupalNodes = []
  try {
    drupalNodes = await Promise.all(items.map(item => {
      return DrupalService.getNode(item.sku)
          .then(node => {
            purchaseTotal += (parseFloat(node.price) * item.quantity)
            return {
              ...node,
              quantity: item.quantity,
            }
          })
    }))
  } catch (error) {
    console.error(error)
    handleCriticalError(`Unable to get drupal nodes`,
        JSON.stringify(error))
    throwError(constants.ERROR_TYPES.DRUPAL_GET_NODES_FAILED, error)
  }
  drupalNodes.forEach(node => {
    if (node.stock < node.quantity) {
      throwError(constants.ERROR_TYPES.PURCHASED_ITEMS_NO_LONGER_AVAILABLE, null, { itemId: node.nid })
    }
  })
  if (purchaseTotal !== total) {
    throwError(constants.ERROR_TYPES.DRUPAL_PRICE_NOT_MATCHING_SENT_PRICE)
  }
  return drupalNodes
}

async function updateDrupalNodes(paymentId, drupalNodes) {
  try {
    drupalNodes.map(node => {
      DrupalService.updateNodeStock(node)
    })
  } catch (error) {
    console.error(error)
    handleCriticalError(`Error occurred updating drupal for purchase ${paymentId}`,
        'Payment was successful, but was unable to update drupal product quantities.' +
        `Please manually go in and update these products.\n\n${JSON.stringify(error)}`)
  }
}

async function createPaypalPayment(items, total) {
  try {
    const paypalPayment = await PayPayService.createPaypalPayment(items, total)
    return paypalPayment
  } catch (error) {
    console.error(error)
    handleCriticalError(`Unable to create paypal payment`,
        JSON.stringify(error))
    throwError(constants.ERROR_TYPES.UNABLE_TO_CREATE_PAYPAL_PAYMENT, error)
  }
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
    console.error(error)
    handleCriticalError(`Unable to retrieve payment info from paypal ${paymentId}`,
        JSON.stringify(error))
    throwError(constants.ERROR_TYPES.UNABLE_TO_RETRIEVE_PAYPAL_PAYMENT, error)
  }
}

async function executePaypalPayment(paymentId, payerId, total) {
  try {
    const paypalPayment = await PayPayService.executePaypalPayment(paymentId, payerId, total)
    return paypalPayment
  } catch (error) {
    console.error(error)
    handleCriticalError(`Unable to execute payment info from paypal ${paymentId}`,
        JSON.stringify(error))
    throwError(constants.ERROR_TYPES.UNABLE_TO_EXECUTE_PAYPAL_PAYMENT, error)
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
      if (!!error.type) {
        return res.status(200).json({error});
      }
      console.error(error)
      handleCriticalError(`Unexpected error occurred!!`, 'Unexpected Error:\n' + JSON.stringify(error) +
          `Failed to create payment with paypal.\n\n${JSON.stringify(error)}`)
      return res.status(500).json({ type: constants.ERROR_TYPES.UNEXPECTED_ERROR, error })
    }
  },
  executePayment: async function (req, res) {
    const { paymentId, payerId } = req.body
    try {
      const paypalPayment = await getPaypalPayment(paymentId)
      const transaction = paypalPayment.transactions[0]
      const total = parseFloat(transaction.amount.total)
      const drupalNodes = await verifyDrupalProducts(transaction.item_list.items, total)
      const results = await executePaypalPayment(paymentId, payerId, total)
      updateDrupalNodes(paymentId, drupalNodes)
      res.statusCode = 200
      res.json({ success: true, results })

    } catch (error) {
      res.statusCode = 500
      if (!!error.type) {
        return res.status(200).json({error});
      }
      console.error(error)
      handleCriticalError(`Unexpected error occurred!!`, 'Unexpected Error:\n' + JSON.stringify(error) +
          `Failed to execute payment with paypal ${paymentId}\n\n${JSON.stringify(error)}`)
      return res.status(500).json({ type: constants.ERROR_TYPES.UNEXPECTED_ERROR, error })
    }
  }
}
