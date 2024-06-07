const express = require('express')
require('dotenv').config()
const cors = require('cors')

const app = express()
const port = 3000

// middleware
app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.send('Welcome')
})

app.listen(port, () => console.log(`listening on http://localhost:${port}`))

