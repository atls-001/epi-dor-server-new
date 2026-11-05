const router = require('express').Router()
const { logError } = require('../misc/error')
const eventModel = require('../models/event-model')
//multer requirements
const multer  = require('multer') 
const storage = multer.memoryStorage()
const upload = multer({ storage: storage }) 


//auth middleware
const { checkAuthorized, checkAdmin, checkOwner } = require('../middleware/authMiddleware')


//aws
const AWSFieldName = 'event_pictures'
const { uploadFileToS3, deleteFileFromS3 } = require('../middleware/awsMiddleware')


//public CRUD routes
router.get('/read-public', async(Req, res) => {
    try {
        const events = await eventModel.find({ public: true })
        return res.status(200).json(events)
    } catch (error) {
        logError( 'Error reading all public events', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu lire les évènements publiques." })
    }
})


//admin CRUD routes
router.get('/read-all', checkAuthorized, checkAdmin, async(req, res) => {
    try {
        const events = await eventModel.find({})
        return res.status(200).json(events)
    } catch (error) {
        logError( 'Error reading all events', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu lire les évènements." })
    }
})
router.post('/create', checkAuthorized, checkAdmin, upload.fields([{name: 'images', maxCount: 10}, {name: 'logo', maxCount: 1}]), async (req, res) => {

    //check body
    const { public, featured, name, graphicType, titleType, start, end, description } = req.body
    if(public == null || featured == null || !name || !graphicType || !titleType || !end || !description)
        return res.status(400).json({ message: "Données textes manquantes." })  

    //check files
    if(!req.files || !req.files.images) return res.status(400).json({ message: "Aucune image fournie." })

    //AWS failsafes
    let logoKey
    let uploadedImages = []

    //message
    let message = ''

    try {
        //upload logo
        if(req.files.logo) {
            logoKey = await uploadFileToS3(req, res, req.files.logo[0], AWSFieldName)
            if(!logoKey) return res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu publier le logo." })
        }

        //upload image files 
        let allFiles = true
        for(const img of req.files.images) {
            let imageKey = await uploadFileToS3(req, res, img, AWSFieldName)
            if(imageKey) allFiles = false
            uploadedImages.push(imageKey)
        }
        if(!allFiles) message += "Nous n'avons pas pu publier toutes les images. "

        //check featured
        let realFeatured = false
        const alreadyFeatured = await eventModel.countDocuments({ featured: true })
        if(alreadyFeatured > 0) message += "Un autre évènement des déjà en avant. "
        else { if(featured) realFeatured = true }

        //create new event
        const newEvent = eventModel({
            public, featured: realFeatured, name, graphicType, titleType, start, end, description, 
            images: uploadedImages
        })
        await newEvent.save()

        //respond
        return res.status(200).json({ message: "Évènement créé avec succès. " + message })

    } catch (error) {
        logError( 'Error creating event: ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu créer l'évènement." })
    }
}) 
router.put('/update/:id', checkAuthorized, checkAdmin, async (req, res) => {
    const { id } = req.params
    if(!id) return res.status(400).json({ message: "ID d'évènement manquant." })

    //check body
    const { public, featured, name, graphicType, titleType, start, end, description } = req.body 

    //message
    let message = ''

    try {
        //check event
        const event = await eventModel.findById(id)
        if(!event) return res.status(404).json({ message: "Aucun évènement avec cet ID retrouvé." })
            
        //update event
        if(public != null) event.public = public
        if(featured != null) {
            if(featured) {
                const alreadyFeaturedCount = await eventModel.countDocuments({ featured: true })
                if(alreadyFeaturedCount > 0) message += 'Un autre évènement des déjà en avant.'
                else event.featured = true
            } else event.featured = true
        }
        if(name) event.name = name
        if(graphicType) event.graphicType = graphicType
        if(titleType) event.titleType = titleType
        if(start) event.start = start
        if(end) event.end = end
        if(description) event.description = description
        await event.save()

        //respond
        return res.status(200).json({ message: "Évènement modifié avec succès. " + message })

    } catch (error) {
        logError( 'Error updating event', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu modifier l'évènement." })
    }
})
router.put('/change-logo/:id', checkAuthorized, checkAdmin, upload.single('logo'), async (req, res) => {
    const { id } = req.params
    if(!id) return res.status(400).json({ message: "ID d'évènement manquant." })

    //logo check
    if(!req.file) return res.status(400).json({ message: "Aucun logo fourni." })

    //AWS failsafe
    let newLogoKey

    //message
    let message = ''

    try {
        //check event
        const event = await eventModel.findById(id)
        if(!event) return res.status(404).json({ message: "Aucun évènement avec cet ID retrouvé" })
        const oldLogoKey = event.logo

        //upload image
        newLogoKey = await uploadFileToS3(req, res, req.file, AWSFieldName)
        if(!newLogoKey) return res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu publier l'image" })
        event.logo = newLogoKey
        await event.save()

        //delete old logo
        if(oldLogoKey) {
            const oldLogoDeleted = await deleteFileFromS3(req, res, oldLogoKey)
            if(!oldLogoDeleted) message += "Nous n'avons pas pu supprimer l'ancien logo. "
        }

        //respond
        return res.status(200).json({ message: "Logo ajouté avec succès. " + message })

    } catch (error) {
        logError( 'Error swapping event logo: ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu changer le logo." })
    }

})
router.put('/move-image/:id/:positionString/:direction', checkAuthorized, checkAdmin, async (req, res) => {
    const { id, positionString, direction } = req.params
    if(!id || !positionString || !direction) return res.status(400).json({ message: "ID d'évènement, position ou direction manquants." })
    if(direction !== 'up' && direction !== 'down') return res.status(400).json({ message: "Direction inconnue." })

    try {
        //check event
        const event = await eventModel.findById(id)
        if(!event) return res.status(404).json({ message: "Aucun évènement avec cet ID trouvé." })
            
        const position = parseInt(positionString)
        if(direction == 'up') {
            //check validity
            if(direction == 0) return res.status(200).json({ message: "L'image des déjà la première." })

            const tempPrevious = event.images[position - 1]
            const tempReal = event.images[position]
            //swap
            event.images[position] = tempPrevious
            event.images[position - 1] = tempReal

        } else if (direction == 'down') {
            //check validity
            if(direction == event.images.length - 1) return res.status(200).json({ message: "L'image des déjà la dernière." })

            const tempNext = event.images[position + 1]
            const tempReal = event.images[position]
            console.log(tempNext, tempReal)
            //swap
            event.images[position] = tempNext
            event.images[position + 1] = tempReal

        } 
        await event.save()

        //respond
        return res.status(200).json({ message: "Image déplacée avec succès." })

    } catch (error) {
        logError( 'Error moving event image: ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu déplacer l'image." })
    }
})
router.put('/add-images/:id', checkAuthorized, checkAdmin, upload.fields([{name: 'images', maxCount: 9}]), async (req, res) => {
    const { id } = req.params
    if(!id) return res.status(400).json({ message: "ID d'évènement manquant." })

    if(!req.files) return res.status(400).json({ message: "Aucune image fournie." })

    //AWS failsafes
    let imageKeys = []

    //message
    let message = '' 

    try {
        //check event
        const event = await eventModel.findById(id)
        if(!event) return res.status(404).json({ message: "Aucun évènement avec cet ID trouvé." })
            
        //upload files
        let allFiles = true 
        for(const img of req.files.images) {
            if(img) {
                const imageKey = await uploadFileToS3(req, res, img, AWSFieldName)
                if(imageKey) { imageKeys.push(imageKey); event.images.push(imageKey) }
                else allFiles = false   
            }
        }
        if(!allFiles) message += "Nous n'avons pas pu publier toutes les images. "

        //save
        await event.save()

        //respond
        return res.status(200).json({ message: "Évènement a été modifié avec succès. " + message })

    } catch (error) {
        logError( 'Error adding image: ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu ajouter l'image." })
    }
})
router.delete('/delete/:id', checkAuthorized, checkAdmin, async(req, res) => {
    const { id } = req.params
    if(!id) return res.status(400).json({ message: "ID d'évènement manquant." })

    try {
        //check event
        const event = await eventModel.findById(id)
        if(!event) return res.status(404).json({ message: "Aucun évènement avec cet ID trouvé." })

        //pre-define file keys
        const logoKey = event.logo? event.logo : null
        const imageKeys = event.images 

        //delete record
        await eventModel.findByIdAndDelete(id)

        //delete logo file
        if(logoKey) { const logoDeleted = await deleteFileFromS3(req, res, logoKey) }
        
        //delete images
        for(const img of imageKeys) { const imageDeleted = await deleteFileFromS3(req, res, img) }

        //respond
        return res.status(200).json({ message: "Évènement supprimé avec succès." })

    } catch (error) {
        logError( 'Error deleting event', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu supprimer l'évènement." })
    }
})
router.delete('/delete-logo/:id', checkAuthorized, checkAdmin, async (req, res) => { 
    const { id } = req.params
    if(!id) return res.status(400).json({ message: "ID d'évènement manquant." })

    try {
        //check event
        const event = await eventModel.findById(id)
        if(!event) return res.status(404).json({ message: "Aucun évènement avec cet ID trouvé." })

        //check logo & title type
        if(!event.logo) return res.status(404).json({ message: "L'évènement n'a pas de logo." })
        if(event.titleType === 'logo' || event.titleType === 'text_logo')
            return res.status(400).json({ message: `Les évènements de type "Logo" ou "Texte + Logo" requierent un logo.` })

        //delete from S3
        const logoDeleted = await deleteFileFromS3(req, res, event.logo)
        if(!logoDeleted) return res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu supprimer le logo du cloud." })

        //delete from record
        event.logo = null
        await event.save()

        //respond
        return res.status(200).json({ message: "Logo supprimé avec succès." })

    } catch (error) {
        logError( 'Error deleting event logo: ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu supprimer le logo de l'évènement." })
    }
})
router.delete('/delete-image/:id', checkAuthorized, checkAdmin, async(req, res) => {  
    const { id } = req.params
    const { key } = req.body 
    if(!id || !key) return res.status(400).json({ message: "ID ou nom d'image manquant." })

    try {
        //check event
        const event = await eventModel.findById(id)
        if(!event) return res.status(404).json({ message: "Aucun évènement avec cet ID trouvé" })

        //check image
        const imageExists = event.images.some(img => img == key)
        if(!imageExists) return res.status(404).json({ message: `Nous n'avons pas trouvé cette image dans l'évènement "${event.name}"` })

        //check images left
        if(event.images.length == 0) return res.status(200).json({ message: "Interdit de supprimer la seule image rstant." })

        //delete image from record
        event.images = event.images.filter(img => img !== key)
        await event.save()

        //delete file from S3
        const imageDeleted = await deleteFileFromS3(req, req, key)
            
        //respond
        return res.status(200).json({ message: "Image supprimée avec succès." })

    } catch (error) {
        logError( 'Error deleting event image: ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu supprimer l'image de l'évènement." })
    }
})


module.exports = router