const express = require('express')
const router = express.Router()
const sessionModel = require('../models/session-model')
const { logError } = require('../misc/error')


async function checkSession(req) { 
    req.session.visited = true
    if(!req.session.user) req.user = undefined

    //check preexistance
    let alreadyExists = false
    const session = await sessionModel.findOne({ sessionId: req.session.id }) 
    if(session) alreadyExists = true

    //act according to preexistance
    if (!alreadyExists) {
        const newSession = new sessionModel({
            sessionId: req.session.id,
            pages: [], 
        })

        await newSession.save()
    }
}


//auth middleware
const { checkAuthorized, checkUnauthorized, checkAdmin, checkOwner } = require('../middleware/authMiddleware')


//public routes
router.put('/update-session', async (req, res) => {
    const { page } = req.body
    if(!req.body) return res.status(400).json({ message: "Couldn't update session: missing data" })

    try {
        await checkSession(req)

        //get session
        const session = await sessionModel.findOne({ sessionId: req.session.id })
        if(!session) return res.status(404).json({ message: "Couldn't update session: session record not found in DB" })

        //update session
        if(page && !session.pages.includes(page)) {
            session.pages.push(page)
            session.markModified('pages')
        } 
        await session.save()

        return res.status(200).json({ message: "Session mise à jour avec succès." })

    } catch(error) {
        logError( "Error updating session: ", error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu mettre la session à jour" })
    }
}) 


//private routes
router.get('/get-general-data/:beforeDate/:afterDate', checkAuthorized, async (req, res) => {
    const { beforeDate, afterDate } = req.params  

    try {
        const sessionData = await sessionModel.find()
        if(!sessionData) return res.status(404).json({ message: "Nous n'avons pas trouvé les données de section." })

        //filter session data
        let filteredSessionData = sessionData
        if(beforeDate && beforeDate != 'null') {
            const beforeDateObj = new Date(beforeDate)
            filteredSessionData = filteredSessionData.filter(ss => new Date(ss.createdAt) < beforeDateObj)
        }
        if(afterDate && afterDate != 'null') { 
            const afterDateObj = new Date(afterDate) 
            filteredSessionData = filteredSessionData.filter(ss => new Date(ss.createdAt) > afterDateObj)
        }

        const data = { total: 0, pages: 0 }  

        filteredSessionData.forEach(line => { 
            data.total += line.pages.length
            data.pages += line.pages.length 
        })  

        return res.status(200).json(data)

    } catch(error) {
        logError( "Error reading general session statistic: ", error )
        res.status(500).json({ message: "Erreur backend, nous n'avons pas pu lire les données statistiques." })
    }
})
router.get('/get-session-data/:name/:beforeDate/:afterDate', checkAuthorized, async (req, res) => {
    const { name, beforeDate, afterDate } = req.params
    if(!name) return res.status(400).json({ message: "Nom de données manquant." })  

    try {
        const sessionData = await sessionModel.find()
        if(!sessionData) return res.status(404).json({ message: "Session data not found" })

        //filter session data
        let filteredSessionData = sessionData
        if(beforeDate && beforeDate != 'null') {
            const beforeDateObj = new Date(beforeDate)
            filteredSessionData = filteredSessionData.filter(ss => new Date(ss.createdAt) > beforeDateObj) 
        } 
        if(afterDate && afterDate != 'null') { 
            const afterDateObj = new Date(afterDate) 
            filteredSessionData = filteredSessionData.filter(ss => new Date(ss.createdAt) < afterDateObj)
        }

        const data = { total: 0 } 

        filteredSessionData.forEach(session => { 
            session[name].forEach( el => {
                if(data[el]) data[el] += 1 
                else data[el] = 1

                data['total'] += 1
            } )
        })

        return res.status(200).json(data)

    } catch(error) {
        logError( "Error reading session statistic: ", error )
        res.status(500).json({ message: `Erreur backend: Nous n'avons pas pu lire les données de session ${name}` })
    }
})


module.exports = router