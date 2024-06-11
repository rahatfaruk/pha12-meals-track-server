const express = require('express')
require('dotenv').config()
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
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
    const collMeals = database.collection('meals')
    const collReviews = database.collection('reviews')


    app.get('/', (req, res) => {res.send('Welcome')})

    // > homepage meals
    app.get('/homepage-meals', async (req, res) => {
      // sort by latest time, max 3 item
      const options = { sort: {post_time: -1}, limit: 3 }

      // latest 3 meal in each category
      const meals1 = await collMeals.find({category: 'breakfast'}, options).toArray()
      const meals2 = await collMeals.find({category: 'lunch'}, options).toArray()
      const meals3 = await collMeals.find({category: 'dinner'}, options).toArray()

      res.send( [...meals1, ...meals2, ...meals3] )
    })
    // > meal details by id
    app.get('/meals/:id', async (req, res) => {
      const query = new ObjectId(req.params.id)
      const meal = await collMeals.findOne(query)
      res.send(meal)
    })
    // > reviews by meal_id
    app.get('/reviews/:meal_id', async (req, res) => {
      const query = {meal_id: req.params.meal_id}
      const reviews = await collReviews.find(query).toArray()
      res.send(reviews)
    })
    
    // > create new user in db
    app.post('/create-user', async (req, res) => {
      const {email, displayName} = req.body
      const newUser = {email, displayName, badge: 'bronze', rank: 'user'}
      const result = await collUsers.insertOne(newUser)
      res.send(result)
    })
    // > stripe element payment
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

