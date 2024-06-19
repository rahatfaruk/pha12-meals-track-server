const express = require('express')
const jwt = require('jsonwebtoken')
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

// custom middleware fnc
async function verifyUser(req, res, next) {
  const email = req.query.email
  const token = req.headers.authorization?.split(' ')[1]

  // if token is not available, return error response
  if (!token) {
    return res.status(401).send({message: 'Unauthorized'})
  }

  // verify user
  try {
    const decoded = jwt.verify(token, process.env.AuthPrivateKey)
    req.decoded = decoded
    next()
  } catch (err) {
    return res.status(401).send({message: 'Unauthorized'})
  }
}

// all api
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
      const searchText = req.query.searchText
      let modifiedQuery = {}

      // update query by searchText 
      if(searchText) {
        // modifiedQuery = { title: { $regex: new RegExp(searchText, 'gi') } }
        modifiedQuery.title = { $regex: new RegExp(searchText, 'gi') }
      }
      if (req.query.category) {
        modifiedQuery.category = req.query.category
      }
      if (req.query.priceMin && req.query.priceMax) {
        // range of price
        modifiedQuery.price = { $gte: +req.query.priceMin, $lte: +req.query.priceMax }
      }

      const meals = await collMeals.find(modifiedQuery).toArray()
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
    // ### user Dashboard
    // > udb: my-requested-meals
    app.get('/requested-meals/:email', async (req, res) => {
      const query = {email: req.params.email}
      // get reviews based on email
      const myReqMeals = await collRequestedMeals.find(query).toArray()
      res.send(myReqMeals)
    })
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
    // > udb: my-payments
    app.get('/my-payments/:email', async (req, res) => {
      const query = {email: req.params.email}
      // get reviews based on email
      const payments = await collPayments.find(query).toArray()
      res.send(payments)
    })
    // > adb: my-requested-meals-count
    app.get('/my-meals-count/:email', async (req, res) => {
      const query = {admin_email: req.params.email}
      const count = await collMeals.countDocuments(query)
      res.send({count})
    })
    // > adb: get all users from db
    app.get('/all-users', async (req, res) => {
      const {email, username} = req.query;
      const myQuery = {}
      if (email) {
        myQuery.email = {$regex: new RegExp(email, 'i') }
      }
      if (username) {
        myQuery.displayName = {$regex: new RegExp(username, 'i') }
      }

      const user = await collUsers.find(myQuery).toArray()
      res.send(user)
    })
    // > adb: get all meals from db
    app.get('/all-meals', async (req, res) => {
      const meals = await collMeals.find().toArray()
      res.send(meals)
    })
    // > adb: get all reviews from db
    app.get('/all-reviews', async (req, res) => {
      const reviews = await collReviews.find().toArray()
      // get meals based on review meal_id
      const mealIds = reviews.map(review => new ObjectId(review.meal_id))
      const mQuery = { _id: {$in: mealIds} }
      const mOptions = {projection: { title:1, likes:1, reviews_count:1} }
      const meals = await collMeals.find(mQuery, mOptions ).toArray()
      res.send({reviews, meals})
    })
    // > admin: all-requested-meals / serve meals
    app.get('/serve-meals', async (req, res) => {
      const {email, username} = req.query;
      const myQuery = {}
      if (email) {
        myQuery.email = {$regex: new RegExp(email, 'i') }
      }
      if (username) {
        myQuery.displayName = {$regex: new RegExp(username, 'i') }
      }

      const reqMeals = await collRequestedMeals.find(myQuery).toArray()
      // get meals (based on review's meal_id)
      const mealIds = reqMeals.map(reqMeal => new ObjectId(`${reqMeal.meal_id}`))
      const mealsQuery = { _id: { $in: mealIds } }
      const mealsOpt = { projection: { title: 1 } }
      const meals = await collMeals.find(mealsQuery, mealsOpt).toArray()

      res.send({reqMeals, meals})
    })
    // > admin: /all-upcoming-meals :: sorted by likes (descending)
    app.get('/all-upcoming-meals', async (req, res) => {
      const upcomingMeals = await collUpcomingMeals.find({}, {sort: {likes:-1}}).toArray()
      res.send(upcomingMeals)
    })
    // > security: generate jwt token
    app.get('/generate-jwt', async (req, res) => {
      const email = req.query.email
      const privateKey = process.env.AuthPrivateKey
      // generate token
      const token = jwt.sign({email}, privateKey, {expiresIn: '3h'})
      res.send(token)
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
    // > adb: add-meal 
    app.post('/add-meal', async (req, res) => {
      const newMeal = req.body
      const result = await collMeals.insertOne(newMeal)
      res.send(result)
    })
    // > adb: add-upcoming-meal 
    app.post('/add-upcoming-meal', async (req, res) => {
      const newMeal = req.body
      const result = await collUpcomingMeals.insertOne(newMeal)
      res.send(result)
    })


    // increment meal-like-count
    app.patch('/inc-meal-like', verifyUser, async (req, res) => {
      if (req.decoded.email !== req.query.email) {
        return res.status(403).send({message: 'forbidden access'})
      }
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
    // > update /update-review
    app.patch('/update-review/:id', async (req, res) => {
      const filter = {_id: new ObjectId(req.params.id)}
      const updateDoc = { $set: req.body }
      const result = await collReviews.updateOne(filter, updateDoc)
      res.send(result)
    })
    // > adb: make the user as admin
    app.patch('/make-admin/:id', async (req, res) => {
      const filter = {_id: new ObjectId(req.params.id)}
      const updateDoc = { $set: {rank: 'admin'} }
      const result = await collUsers.updateOne(filter, updateDoc)
      res.send(result)
    })
    // > adb: update serve (requested) meal
    app.patch('/update-serve-meal/:reqMealId', async (req, res) => {
      const filter = {_id: new ObjectId(req.params.reqMealId)}
      const updateDoc = { $set: {status: 'delivered'} }
      const result = await collRequestedMeals.updateOne(filter, updateDoc)
      res.send(result)
    })

    // > udb: delete-requested-meal
    app.delete('/delete-requested-meal/:id', async (req, res) => {
      const filter = {_id: new ObjectId(req.params.id)}
      const result = await collRequestedMeals.deleteOne(filter)
      res.send(result) 
    })
    // > user, admin:: delete-review
    app.delete('/delete-review/:id', async (req, res) => {
      const filter = {_id: new ObjectId(req.params.id)}
      const result = await collReviews.deleteOne(filter)
      res.send(result) 
    })
    // > admin: delete-meal
    app.delete('/delete-meal/:id', async (req, res) => {
      const mealId = req.params.id
      // delete meal
      const filterMeal = {_id: new ObjectId(mealId)}
      const result = await collMeals.deleteOne(filterMeal)
      // delete reviews
      const filterReviews = {meal_id: mealId}
      await collReviews.deleteMany(filterReviews)
      res.send(result) 
    })
    // > admin: publish-upcoming-meal 
    app.delete('/delete-upcoming-meal/:id', async (req, res) => {
      const query = {_id: new ObjectId(req.params.id)}
      const result = await collUpcomingMeals.deleteOne(query)
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

