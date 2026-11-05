const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const userModel = require('../models/user-model')
const refreshTokenModel = require('../models/refreshToken-model')
const jwt = require('jsonwebtoken')

const { logError } = require('../misc/error')


//auth middleware
const { checkAuthorized, checkUnauthorized, checkAdmin, checkOwner } = require('../middleware/authMiddleware')


//jwt
const jwtExpires = 3 //also exists in auth middleware, please keep a match
function generateJWT(id, rank) {
    return jwt.sign(
        { iss: 'atlasoft backend', sub: id, rank }, 
        process.env.JWT_SECRET,
        { expiresIn: `${jwtExpires}m` }
    )
} 
function generateRefreshJWT(id, rank) {
    return jwt.sign(
        { iss: 'atlasoft backend', sub: id, rank }, 
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: `12h` }
    )
}


//current user
let currentUser
async function readCurrentUser(req, res) {
    //get the token
    const token = req.cookies.accessToken 
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET) 

    //get user
    const user = await userModel.findById(decodedToken.sub).select('-password') 
    if(!user) return res.status(404).json({ message: "Current user not found" }) 

    return user
}


//CRUD roudes
router.post('/login', checkUnauthorized, async (req, res) => {
    const { email, password } = req.body 
    if(!email || !password) return res.status(400).json({ message: "Email ou mot de passe manquant." })

    try {
        const user = await userModel.findOne({ email: email })
        if(!user) return res.status(404).json({ message: "Email ou mot de passe incorrect." })

        //compare passwords
        const rightPassword = await bcrypt.compare(password, user.password)
        if(!rightPassword) return res.status(409).json({ message: "Email out mot de passe  incorrect." }) 

        //create jwt
        const token = generateJWT(user._id, user.rank) 
        const refreshToken = generateRefreshJWT(user._id, user.rank)

        //save refresh token
        const newRFT = new refreshTokenModel({ token: refreshToken })
        await newRFT.save()

        //respond 
        res.cookie("accessToken", token, {
            httpOnly: true,      // can’t be accessed by JS
            secure: true,
            sameSite: "none",  // prevents CSRF in most cases 
        })  
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,      // can’t be accessed by JS
            secure: true,
            sameSite: "none",  // prevents CSRF in most cases 
        })  

        return res.status(200).json({ message: "Connecté avec succès.", user })

    } catch(error) {
        logError( `Error logging in: `, error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu vous connecter." })
    }
}) 
router.delete('/logout', checkAuthorized, async (req, res) => {
    try {
        //get tokens (already vefiried in checkAuthorized middleware)
        const token = req.cookies.accessToken 
        const refreshToken = req.cookies.refreshToken 

        //delete refresh token from DB
        await refreshTokenModel.deleteOne({ token: refreshToken })

        //clear cookies  
        res.clearCookie("accessToken", token, {
            httpOnly: true,      // can’t be accessed by JS
            secure: true,
            sameSite: "none",  // prevents CSRF in most cases 
        })  
        res.clearCookie("refreshToken", refreshToken, {
            httpOnly: true,      // can’t be accessed by JS
            secure: true,
            sameSite: "none",  // prevents CSRF in most cases 
        })

        return res.status(200).json({ message: "Déconnecté avec succès." })

    } catch(error) {
        logError( `Error logging out: `, error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu vous déconnecter." })
    }
})


//check routes
router.get('/check-auth', checkAuthorized, async (req, res) => {
    try {
        currentUser = await readCurrentUser(req, res)
        res.status(200).json({ message: "Vous êtes autorisés", user: currentUser })
    } catch(error) {
        logError( `Error logging in: `, error )
        res.status(500).json({ message: `Erreur backend: Nous n'avons pas pu vérifier votre autorisation.` })
    }
})
router.get('/check-unauth', checkUnauthorized, async (req, res) => {
    try {
        res.status(200).json({ message: "Vous n'êtes pas autorisés" })
    } catch(error) {
        logError( `Error logging in: `, error )
        res.status(500).json({ message: `Erreur backend: Nous n'avons pas pu vérifier votre autorisation.` })
    }
})
router.get('/check-admin', checkAuthorized, checkAdmin, async (req, res) => {
    try {
        res.status(200).json({ message: "Vous êtes administrateur" })
    } catch(error) {
        logError( `Error checking admin: `, error )
        res.status(500).json({ message: `Erreur backend: Nous n'avons pas pu vérifier votre rang.` })
    }
})
router.get('/check-owner', checkAuthorized, checkOwner, async (req, res) => {
    try {
        res.status(200).json({ message: "Vous êtes propriétaire" })
    } catch(error) {
        logError( `Error checking owner: `, error )
        res.status(500).json({ message: `Erreur backend: Nous n'avons pas pu vérifier votre rang.` })
    }
})


module.exports = router