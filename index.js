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
    const collRequestedMeals = database.collection('requested-meals')
    const collUpcomingMeals = database.collection('upcoming-meals')
    const collPricingPlan = database.collection('pricing-plan')
    const collPayments = database.collection('payments')


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
    // > all meals
    app.get('/meals', async (req, res) => {
      const meals = await collMeals.find().toArray()
      res.send( meals )
    })
    // > pricing plan
    app.get('/pricing-plan', async (req, res) => {
      const badge = req.query.badge
      if (badge) {
        const pricingPlan = await collPricingPlan.findOne({name:badge})
        res.send( pricingPlan )
      } else {
        const pricingPlan = await collPricingPlan.find().toArray()
        res.send( pricingPlan )
      }
    })
    // > all upcoming meals
    app.get('/upcoming-meals', async (req, res) => {
      const meals = await collUpcomingMeals.find().toArray()
      res.send( meals )
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
    // > get user from db
    app.get('/users/:email', async (req, res) => {
      const query = {email: req.params.email}
      const user = await collUsers.findOne(query)
      res.send(user)
    })
    // > udb: my-requested-meals
    app.get('/requested-meals/:email', async (req, res) => {
      const query = {email: req.params.email}
      // get reviews based on email
      const myReqMeals = await collRequestedMeals.find(query).toArray()
      res.send(myReqMeals)
    })
    // ### user Dashboard
    // > udb: reviews-with-meals
    app.get('/reviews-with-meals/:email', async (req, res) => {
      const query = {reviewer_email: req.params.email}
      // get reviews based on email
      const reviews = await collReviews.find(query).toArray()
      // create array of meal ids; get meals (review id matched)
      const mealIds = reviews.map(review => new ObjectId(`${review.meal_id}`))
      const mealsQuery = { _id: { $in: mealIds } }
      const mealsOpt = { projection: {_id: 1, title: 1, likes: 1} }
      const meals = await collMeals.find(mealsQuery, mealsOpt).toArray()
  
      res.send({meals, reviews})
    })
    // > udb: my-requested-meals
    app.get('/my-requested-meals/:email', async (req, res) => {
      const query = {email: req.params.email}
      // get reviews based on email
      const myReqMeals = await collRequestedMeals.find(query).toArray()
      // create array of meal ids; get meals (review id matched)
      const mealIds = myReqMeals.map(reqMeal => new ObjectId(`${reqMeal.meal_id}`))
      const mealsQuery = { _id: { $in: mealIds } }
      const mealsOpt = { projection: {_id: 1, title: 1, likes: 1, reviews_count:1} }
      const meals = await collMeals.find(mealsQuery, mealsOpt).toArray()

      res.send({meals, myReqMeals})
    })
    
    // > create new user in db
    app.post('/create-user', async (req, res) => {
      const {email, displayName} = req.body
      const newUser = {email, displayName, badge: 'bronze', rank: 'user'}
      const result = await collUsers.insertOne(newUser)
      res.send(result)
    })
    // > add new review in reviews
    app.post('/add-review', async (req, res) => {
      const review = req.body
      const result = await collReviews.insertOne(review)
      res.send(result)
    })
    // > add-requested-meal in req-meals collection
    app.post('/add-requested-meal', async (req, res) => {
      const requestedMeal = req.body
      const result = await collRequestedMeals.insertOne(requestedMeal)
      res.send(result)
    })
    // > store-payment-info 
    app.post('/store-payment-info', async (req, res) => {
      const paymentInfo = req.body
      const result = await collPayments.insertOne(paymentInfo)
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
    // increment meal-like-count
    app.patch('/inc-meal-like', async (req, res) => {
      const filter = { _id: new ObjectId(`${req.body.meal_id}`)}
      const updateDoc = { $inc: {likes: 1} }
      const result = await collMeals.updateOne(filter, updateDoc)
      res.send(result)
    })
    // increment upcoming-meal-like-count
    app.patch('/inc-upcoming-meal-like', async (req, res) => {
      const filter = { _id: new ObjectId(`${req.body.meal_id}`)}
      const updateDoc = { $inc: {likes: 1} }
      const result = await collUpcomingMeals.updateOne(filter, updateDoc)
      res.send(result)
    })
    // > update user in db
    app.patch('/update-user', async (req, res) => {
      const filter = {email: req.query.email}
      const updateDoc = { $set: {badge: req.body.badge} }
      const result = await collUsers.updateOne(filter, updateDoc)
      res.send(result)
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

