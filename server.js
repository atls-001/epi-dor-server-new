const dotenv = require('dotenv')
dotenv.config()
const express = require('express')
const session = require('express-session')
const cors = require('cors')
const mongoose = require('mongoose')
const path = require('path')
const cookieParser = require('cookie-parser')


//app up
const app = express()
app.set('trust proxy', 1) //Nginx proxy
app.use(express.urlencoded({ limit: '50mb', extended: true }))
app.use(express.json({ limit: '50mb' }))  


//setting up session
app.use(session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
    cookie: {
        httpOnly: process.env.NODE_ENV === 'prod',
        secure: process.env.NODE_ENV === 'prod',
        sameSite: process.env.NODE_ENV === 'prod' ? 'none' : 'lax',
        maxAge: 30 * 60 * 1000
    }
}))
app.use(cookieParser())


//cors setup
app.use(cors({
    credentials: true,
    origin: [
        "http://localhost:7010", "https://main.d3mnoq1bc4tbv7.amplifyapp.com/", 
        "http://localhost:7011"]

}))
console.log('\n Cors was setup successfully \n')


//server and db config
const mongoURI = process.env.MONGO_URI
const port = process.env.PORT || 9000
const host = process.env.HOST || '0.0.0.0'
mongoose.connect(mongoURI).then(() => {
    app.listen(port, host, (err) => {
        if(err) return console.log(`ERROR! Couldn't connect to http://${host}:${port} \n`)
        return console.log(`Successfully connected to database and running on http://${host}:${port} \n`)
    })
}).catch((err) => {console.log(`Connection to database failed. Error: ${err} \n`)})  


//routers
const generalRouter = require('./routers/general-router.js')
const statisticsRouter = require('./routers/statistics-router.js')
const menuRouter = require('./routers/menu-router.js')
const locationsRouter = require('./routers/location-router.js')
const eventsRouter = require('./routers/events-router.js')
const userRouter = require('./routers/user-router.js')
const authRouter = require('./routers/auth-router.js')
app.use('/general', generalRouter) 
app.use('/statistics', statisticsRouter) 
app.use('/menu', menuRouter) 
app.use('/locations', locationsRouter) 
app.use('/events', eventsRouter) 
app.use('/users', userRouter) 
app.use('/auth', authRouter) 