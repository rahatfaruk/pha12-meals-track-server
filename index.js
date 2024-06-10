const express = require('express')
require('dotenv').config()
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb')
const stripe = require('stripe')(process.env.SecretPaymentKey)

const mongoUri = `mongodb+srv://${process.env.UserMDB}:${process.env.PasswordMDB}@cluster0.ympa4ek.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
const app = express()
const port = process.env.PORT || 3000
const client = new MongoClient(mongoUri, {
  serverApi: { version: ServerApiVersion.v1, strict:true, deprecationErrors:true }
})

// middleware
app.use(cors())
app.use(express.json())

async function main() {
  try {
    await client.connect()
    const database = client.db('pha12')
    // collections
    const collUsers = database.collection('users')


    app.get('/', (req, res) => {res.send('Welcome')})
    
    app.post('/create-user', async (req, res) => {
      const {email, displayName} = req.body
      const newUser = {email, displayName, badge: 'bronze', rank: 'user'}
      const result = await collUsers.insertOne(newUser)
      res.send(result)
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

    // check connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment")
    } catch (error) {
      console.log("Error in deployment", error?.message)
  }
}

main()

app.listen(port, () => console.log(`listening on http://localhost:${port}`))

