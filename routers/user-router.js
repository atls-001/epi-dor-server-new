const router = require('express').Router()
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
//context
const { logError } = require('../misc/error.js')
//models
const userModel = require('../models/user-model.js')


//auth middleware
const { checkAuthorized, checkUnauthorized, checkAdmin, checkOwner } = require('../middleware/authMiddleware')


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


router.post('/create', checkAuthorized, checkOwner, async (req, res) => {
    const { firstName, lastName, rank, email, password } = req.body
    if(!firstName || !lastName || !rank || !email || !password) return res.status(400).json({ message: "Données manquantes." })

    try {
        //hash password
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        const newUser = new userModel({
            firstName, lastName, email, rank,
            password: hashedPassword
        })
        await newUser.save()

        //respond
        return res.status(201).json({ message: "Compte d'utilisateur créé avec succès." })

    } catch (error) {
        logError( 'Error creating user: ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu créer le compte d'utilisateurs." })
    }
})
router.get('/read-all', checkAuthorized, checkOwner, async (req, res) => {
    try {
        currentUser = await readCurrentUser(req, res)
        if(!currentUser) return

        let users = await userModel.find()
        users = users.filter(usr => usr.id != currentUser.id)
        return res.status(200).json(users)
    } catch (error) {
        logError( 'Error reading all users: ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu lire les utilisateurs." })
    }
})
router.get('/read-current', checkAuthorized, checkOwner, async (req, res) => {
    try {
        currentUser = await readCurrentUser(req, res)
        if(!currentUser) return

        return res.status(200).json(currentUser)

    } catch(error) {
        logError( 'Error reading current user: ', error )
        res.status(500).json({ message: "Backend error: Couldn't read current user" })
    }
})
router.put('/update/:id', checkAuthorized, checkOwner, async (req, res) => {
    const { id } = req.params
    if(!id) return res.status(400).json({ message: "ID d'utilisateur manquant." })
        
    const { firstName, lastName, rank, email, password } = req.body    

    let message = ''

    try {
        //check users
        const user = await userModel.findById(id)
        if(!user) return res.status(404).json({ message: "Nous n'avons pas pu trouver d'utilisateur avec cet ID. " })
        
        //update fields
        if(firstName) user.firstName = firstName
        if(lastName) user.lastName = lastName
        if(rank && user.rank !== 'owner' && user !== 'developer') user.rank = rank
        if(rank && user.rank === 'owner' || rank && user.rank === 'developer') message += 'Mais le rang des utilisateurs de ce rang ne peut pas être modifié'
        if(email) user.email = email
        if(password) {
            const salt = await bcrypt.genSalt(10)
            const hashedPassword = await bcrypt.hash(password, salt)
            user.password = hashedPassword
        }
        await user.save()

        //respond
        return res.status(200).json({ message: "Le utilisateur modifié avec succès. " + message })

    } catch (error) {
        logError( 'Error updating user: ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu modifier l'utilisateur." })
    }
})
router.delete('/delete/:id', checkAuthorized, checkOwner, async (req, res) => {
    const { id } = req.params
    if(!id) return res.status(400).json({ message: "ID d'utilisateur manquant." })

    try {
        //check user rank
        const user = await userModel.findById(id)
        if(!user) return res.status(404).json({ message: "Aucun utilisateur avec cet ID trouvé." })
        if(user.rank === 'developer' || user.rank === 'owner') return res.status(400).json({ message: "Impossible de supprimer les utilisateurs avec ce rang." })

        //check user count
        const userCount = await userModel.countDocuments()
        if(userCount <= 1) return res.status(409).json({ message: "Il ne reste pas assez d'utilisateurs." })

        //delete user
        const deleted = await userModel.findByIdAndDelete(id)
        if(!deleted) return res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu supprimer l'utilisateur." })
        return res.status(200).json({ message: "L'utilisateur a été supprimé avec succès." })

    } catch (error) {
        logError( 'Error reading all users', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu supprimer l'utilisateurs." })
    }
})
router.delete('/delete-my-account/:id', checkAuthorized, checkOwner, async (req, res) => {
    const { id } = req.params
    const { password } = req.body
    if(!id || !password) return res.status(400).json({ message: "ID ou mot de passe manquant." }) 

    try {
        //check user rank
        const user = await userModel.findById(id)
        if(!user) return res.status(404).json({ message: "Aucun utilisateur avec cet ID trouvé." }) 

        //check password
        const passwordMatch = await bcrypt.compare(password, user.password)
        if(!passwordMatch) return res.status(400).json({ message: "Mot de passe incorrect." })

        //check user count
        let userCount = await userModel.countDocuments()
        if(user.rank == 'developer' || user.rank == 'owner') { userCount = await userModel.countDocuments({ $or: [{ rank: 'owner' }, { rank: 'developer' }] }) }
        if(userCount <= 1) return res.status(409).json({ message: "Pas assez d'utilisateurs pour cette opération." })

        //delete user
        const deleted = await userModel.findByIdAndDelete(id) 

        //respond
        return res.status(200).json({ message: "Utilisateur supprimé avec succès." })

    } catch (error) {
        logError( 'Error reading all users', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu supprimer l'utilisateurs." })
    }
})


module.exports = router