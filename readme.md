# PHA12 : MealsTrack
**Everything is explained in frontend repo**. Deployed on vercel

## Links:   
  - my frontend repo: [pha12-meals-track-client](https://github.com/rahatfaruk/pha12-meals-track-client), [phero-private-repo](https://github.com/programming-hero-web-course1/b9a12-client-side-rahatfaruk)  


## How can you run backend locally:
  - clone this repo
  - create `.env` file in root folder. redefine these keys with your own values: mongodb username and passwors (`PasswordMDB, UserMDB`), private-key for jwt (`AuthPrivateKey`), stripe payment key (`SecretPaymentKey`)
  - uncomment `await client.connect()` line inside 'index.js'.
  - run project: `npm run dev`