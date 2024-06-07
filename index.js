const express = require('express')
require('dotenv').config()
const cors = require('cors')
const stripe = require('stripe')(process.env.SecretPaymentKey)

const app = express()
const port = 3000

// middleware
app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.send('Welcome')
})

// stripe element payment
app.post('/create-payment-intent', async (req, res) => {
  const {price} = req.body 
  // flatten price
  const flatPrice = parseInt(price * 100)
  
  const paymentIntent = await stripe.paymentIntents.create({
    amount: flatPrice,
    currency: "usd"
  })

  res.send({clientSecret: paymentIntent.client_secret})
})

app.listen(port, () => console.log(`listening on http://localhost:${port}`))

