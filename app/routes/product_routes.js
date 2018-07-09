const productPath = '/product'
module.exports = function(app, db) {
  app.post('/product/purchased', (req, res) => {
    console.log(req.body)
    res.send('Hello')
  });
};
