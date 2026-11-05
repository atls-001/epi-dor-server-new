const router = require('express').Router()
const { logError } = require('../misc/error')
const locationModel = require('../models/location-model')
//multer requirements
const multer  = require('multer') 
const storage = multer.memoryStorage()
const upload = multer({ storage: storage }) 


//auth middleware
const { checkAuthorized, checkAdmin, checkOwner } = require('../middleware/authMiddleware')


//aws
const AWSFieldName = 'location_pictures'
const { uploadFileToS3, deleteFileFromS3 } = require('../middleware/awsMiddleware')


//admin CRUD
router.post('/create', checkAuthorized, checkAdmin, upload.fields([{name: 'images', maxCount: 10}]), async(req, res) => {
    //check body
    const { public, featured, name, address, mapLink, description } = req.body 
    if(public == null || featured == null || !name || !address || !mapLink || !description)
        return res.status(400).json({ message: "Données manquantes." })

    //check files
    if(!req.files || !req.files.images)
        return res.status(400).json({ message: "Aucune image fournie." })

    //AWS failsafes
    let locationSaved = false
    let imageKeys = []

    //message
    let message = ''

    try {
        //upload files
        let allImages = true
        for(const img of req.files.images) {
            const imageKey = await uploadFileToS3(req, res, img, AWSFieldName)
            if(!imageKey) allImages = false
            imageKeys.push(imageKey)
        }
        if(!allImages) message += "Nous n'avons pas pu publier toutes les images. "

        //create record
        const newLocation = new locationModel({
            public, featured, name, address, mapLink, description, images: imageKeys
        })
        await newLocation.save()
        locationSaved = true

        //respond
        return res.status(200).json({ message: "Local créé avec succès. " + message })

    } catch (error) {
        logError( 'Error creating location: ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu ajouter le local."})

        if(imageKeys.length > 0 && !locationSaved)
            for(const img of images) { const imageDeleted = await deleteFileFromS3(req, res, img) }
    }
})
router.get('/read-all', checkAuthorized, checkAdmin, async (req, res) => {
    try {
        const locations = await locationModel.find({})
        return res.status(200).json(locations)
    } catch (error) {
        logError( 'Error reading all locations: ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu lire les locaux." })
    }
})
router.put('/update/:id', checkAuthorized, checkAdmin, async (req, res) => {
    const { id } = req.params
    if(!id) return res.status(400).json({ message: "ID de location manquant." })

    //check body
    const { public, featured, name, address, mapLink, description } = req.body 

    try {
        //check location
        const location = await locationModel.findById(id)
        if(!location) return res.status(404).json({ message: "Aucune location avec cet ID trouvé." }) 

        //update record
        if(public !== null) location.public = public
        if(featured !== null) location.featured = featured
        if(name) location.name = name
        if(address) location.address = address
        if(mapLink) location.mapLink = mapLink
        if(description) location.description = description
        await location.save()

        //respond
        return res.status(200).json({ message: "Local modifié avec succès." })

    } catch (error) {
        logError( 'Error updating location: ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu modifier le local." })
    }
})
router.put('/add-images/:id', checkAuthorized, checkAdmin, upload.fields([{ name: 'images', maxCount: 10 }]), async(req, res) => {
    const { id } = req.params
    if(!id) return res.status(400).json({ message: "ID de location manquant." })

    //check files
    if(!req.files || !req.files.images) return res.status(400).json({ message: "Aucune nouvelle image fournie." })

    //AWS failsafes
    let imageKeys = []

    //message
    let message = ''

    try {
        //check location
        const location = await locationModel.findById(id)
        if(!location) return res.status(404).json({ message: "Aucune location avec cet ID trouvé." }) 

        //upload files
        let allFiles = true
        for(const img of req.files.images) {
            const imageKey = await uploadFileToS3(req, res, img, AWSFieldName)
            if(!imageKey) allFiles = false
            else imageKeys.push(imageKey) 
        }
        if(!allFiles) message += "Nous n'avons pas pu ajouter toutes les images. "

        //update record
        for(const img of imageKeys) { location.images.push(img) }
        await location.save()

        //respond
        return res.status(200).json({ message: "Image ajoutée avec succès. " + message })

    } catch (error) {
        logError( 'Error adding image to location: ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu ajouter l'image." })
    }
})
router.put('/move-image/:id/:positionString/:direction', checkAuthorized, checkAdmin, async (req, res) => {
    const { id, positionString, direction } = req.params
    if(!id || !positionString || !direction) return res.status(400).json({ message: "ID ou direction manquant." })
    if(direction !== 'up' && direction !== 'down') return res.status(400).json({ message: "Direction inconnue." })

    try {
        //check location
        const location = await locationModel.findById(id)
        if(!location) return res.status(404).json({ message: "Aucune location avec cet ID trouvé." }) 
            
        const position = parseInt(positionString)
        if(direction == 'up') {
            //check validity
            if(direction == 0) return res.status(200).json({ message: "L'image des déjà la première." })

            const tempPrevious = location.images[position - 1]
            const tempReal = location.images[position]
            //swap
            location.images[position] = tempPrevious
            location.images[position - 1] = tempReal

        } else if (direction == 'down') {
            //check validity
            if(direction == location.images.length - 1) return res.status(200).json({ message: "L'image des déjà la dernière." })

            const tempNext = location.images[position + 1]
            const tempReal = location.images[position]
            console.log(tempNext, tempReal)
            //swap
            location.images[position] = tempNext
            location.images[position + 1] = tempReal

        } 
        await location.save()

        //respond
        return res.status(200).json({ message: "Image déplacée avec succès." })

    } catch (error) {
        logError( 'Error moving location image: ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu déplacer l'image." })
    }
})
router.delete('/delete/:id', checkAuthorized, checkAdmin, async(req, res) => {
    const { id } = req.params
    if(!id) return res.status(400).json({ message: "ID de location manquant." })

    //message
    let message = ''

    try {
        //check location
        const location = await locationModel.findById(id)
        if(!location) return res.status(404).json({ message: "Aucune location avec cet ID trouvé." }) 
        let images = [...location.images]

        //delete images
        let deletedAll = true
        for(const img of location.images) {
            const imageDeleted = await deleteFileFromS3(req, res, img)
            if(!imageDeleted) deletedAll = false
            else images = images.filter(img_ => img_ !== img)
        }
        if(!deletedAll) {
            message += "Nous n'avons pas pu supprimer toutes les images. "
            location.images = images
            await location.save()
        }

        //delete record
        const locationDeleted = await locationModel.findByIdAndDelete(id)

        //respond
        return res.status(200).json({ message: "Local supprmié avec succès. " + message })

    } catch (error) {
        logError( 'Error deleting location', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu supprimer le local." })
    }
})
router.delete('/delete-image/:id', checkAuthorized, checkAdmin, async(req, res) => {
    const { id } = req.params
    const { key } = req.body 
    if(!id || !key) return res.status(400).json({ message: "ID de location ou nom d'image manquant." }) 

    //message
    let message = ''

    try {
        //check location
        const location = await locationModel.findById(id)
        if(!location) return res.status(404).json({ message: "Aucune location avec cet ID trouvé." }) 
        let images = [...location.images]

        //check image
        const imageExists = location.images.some(img => img === key)
        if(!imageExists) return res.status(404).json({ message: "Image absente du local." })

        //check if not only image
        if(location.images.length <= 1) return res.status(200).json({ message: "Il doit rester au moins une image." })

        //delete image file
        const imageDeleted = await deleteFileFromS3(req, res, key)
        if(!imageDeleted) return res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu supprimer l'image du cloud." })

        //delete image from record
        location.images = location.images.filter(img => img !== key)
        await location.save()

        //respond
        return res.status(200).json({ message: "Image supprmiée avec succès. " + message })

    } catch (error) {
        logError( 'Error deleting location image', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu supprimer l'image." })
    }
})


module.exports = router