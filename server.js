// server.js
const express = require('express')

const app = express()
const port = 8000

app.use(express.json());

require('./app/routes')(app, {})

app.listen(port, () => {
  console.log('We are live on ' + port)
});

