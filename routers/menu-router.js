const router = require('express').Router()
const { logError } = require('../misc/error')
const categoryModel = require('../models/menuCategory-model.js')
const itemModel = require('../models/menuItem-model.js')
//multer requirements
const multer  = require('multer') 
const storage = multer.memoryStorage()
const upload = multer({ storage: storage }) 


//auth middleware
const { checkAuthorized, checkAdmin, checkOwner } = require('../middleware/authMiddleware')


//aws
const AWSFieldName = 'menu_pictures'
const { uploadFileToS3, deleteFileFromS3 } = require('../middleware/awsMiddleware')


//category public CRUD
router.get('/read-public-categories', async (req, res) => {
    try {
        const categories = await categoryModel.find({ public: true })
        return res.status(200).json(categories)
    } catch (error) {
        logError( 'Error reading public menu categories', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu lire les catégories publiques." })
    }
})

//category CRUD
router.get('/read-all-categories', checkAuthorized, checkAdmin, async (req, res) => {
    try {
        const categories = await categoryModel.find({})
        return res.status(200).json(categories)
    } catch (error) {
        logError( 'Error reading all menu categories', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu lire les catégories." })
    }
})
router.post('/create-category', checkAuthorized, checkAdmin, upload.single('image'), async (req, res) => {
    const { name, public } = req.body
    if(!name || !req.file) return res.status(400).json({ message: "Données manquantes pour créer la catégorie" })

    let pictureUploaded
    let pictureKey

    try {
        //upload file
        pictureKey = await uploadFileToS3(req, res, req.file, AWSFieldName)
        if(!pictureKey) return res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu mettre la photo en ligne." })
        pictureUploaded = true 

        //save new category
        const newCategory = new categoryModel({
            name, public, image: pictureKey
        })
        await newCategory.save()

        //respond
        return res.status(200).json({ message: "Catégorie créée avec succès." })

    } catch (error) {
        logError( 'Error creating menu category', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu créer la catégorie." })

        if(pictureUploaded && pictureKey) { const fileDeleted = await deleteFileFromS3(req, res, pictureKey) }
    }
})
router.put('/update-category/:id', checkAuthorized, checkAdmin, upload.single('image'), async (req, res) => {
    const { id } = req.params
    if(!id) return res.status(400).json({ message: "ID de catégorie manqunat" })

    //body check
    const { name, public } = req.body

    //new pic failsafes
    let newImageGiven = req.file? true : false
    console.log(newImageGiven)
    let newImageUploaded = false
    let newImageKey

    //message
    let message = ''

    try {
        //check category
        const category = await categoryModel.findById(id)
        if(!category) return res.status(404).json({ message: "Aucune catégorie avec cet ID" })

        //upload new picture
        const oldImageKey = category.image
        if(newImageGiven) {
            newImageKey = await uploadFileToS3(req, res, req.file, AWSFieldName)
            if(!newImageKey) message += "Nous n'avons pas pu mettre la bannière à jour. "
            else {
                category.image = newImageKey
                newImageUploaded = true

                //delete old image
                const oldImageDeleted = await deleteFileFromS3(req, res, oldImageKey)
                if(!oldImageDeleted) message += "Nous n'avons pas pu supprimer l'ancienne bannière."
            }
        }

        //update fields
        if(name) category.name = name
        if(public !== null) category.public = public
        
        //save
        await category.save()

        //respond
        return res.status(200).json({ message: "Catégorie modifiée avec succès. " + message })

    } catch (error) {
        logError( 'Error updating menu category', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu mettre la catégorie à jour." })

        if(newImageGiven && newImageUploaded && newImageKey) { const fileDeleted = await deleteFileFromS3(req, res, newImageKey) }
    }
})
router.delete('/delete-category/:id', checkAuthorized, checkAdmin, async (req, res) => {
    const { id } = req.params
    if(!id) return res.status(400).json({ message: "Aucun ID de catégorie n'a été fourni" })

    try {
        //check category
        const category = await categoryModel.findById(id)
        if(!category) return res.status(404).json({ message: "Aucune catégorie avec cet ID" })
        const categoryID = category.id

        //delete image
        const imageDeleted = await deleteFileFromS3(req, res, category.image)
        if(!imageDeleted) return res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu supprimer la bannière." })

        //delete record
        await categoryModel.findByIdAndDelete(id)

        //delete all related items
        await itemModel.deleteMany({ category: categoryID })

        //respond
        return res.status(200).json({ message: "Catégorie supprmiée avec succès." })

    } catch (error) {
        logError( 'Error deleting menu category', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu supprimer la catégorie." }) 
    }
})


//item public CRUD
router.get('/read-public-items/:categoryID', async (req, res) => {
    const { categoryID } = req.params
    if(!categoryID) return res.status(400).json({ message: "ID de catégorie manquant." })

    try {
        const items = await itemModel.find({ category: categoryID, public: true })
        return res.status(200).json(items)
    } catch (error) {
        logError( 'Error reading public menu items', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu lire les items publiques." })
    }
})

//item CRUD
router.get('/read-items/:categoryID', checkAuthorized, checkAdmin, async (req, res) => {
    const { categoryID } = req.params
    if(!categoryID) return res.status(400).json({ message: "ID de catégorie manqunat." })
        
    try {
        const items = await itemModel.find({ category: categoryID })
        return res.status(200).json(items)
    } catch (error) {
        logError( 'Error reading menu items', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu lire les items de la catégorie." })
    }
})
router.post('/create-item/:categoryID', checkAuthorized, checkAdmin, upload.single('image'), async (req, res) => {
    const { categoryID } = req.params 
    if(!categoryID) return res.status(400).json({ message: "ID de catégorie manquant." })

    //check body
    const { name, public, description } = req.body
    if(!name || public == null || !description || !req.file) return res.status(400).json({ message: "Données manquantes" })

    //image upload failsaves
    let imageUploaded
    let imageKey

    try {
        //check id
        const categories = await categoryModel.countDocuments({ _id: categoryID }) 
        if(categories < 1) return res.status(404).json({ message: "Aucune catégorie avec cet ID" })

        //upload image
        imageKey = await uploadFileToS3(req, res, req.file, AWSFieldName)
        if(!imageKey) return res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu publier l'image" })
        imageUploaded = true

        //create new item
        const newItem = new itemModel({
            category: categoryID, name, public, description, image: imageKey
        })
        await newItem.save()

        //respond
        return res.status(200).json({ message: "Item créé avec succès." })

    } catch (error) {
        logError( 'Error creating menu item', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu créer l'item." })
        if(imageUploaded && imageKey) { const imageDeleted = await deleteFileFromS3(req, res, imageKey) }
    }
})
router.put('/update-item/:id', checkAuthorized, checkAdmin, upload.single('image'), async (req, res) => {
    const { id } = req.params
    if(!id) return res.status(400).json({ message: "ID d'item manquant." })

    //check body
    const { name, public, description } = req.body 

    //image upload failsaves
    let imageProvided = req.file? true : false
    let newImageUploaded
    let newImageKey

    //message
    let message = ''

    try {
        //check item
        const item = await itemModel.findById(id)
        if(!item) return res.status(404).json({ message: "Aucun item avec cet ID n'a été retrouvé." })
        
        //upload image
        const oldImageKey = item.image
        if(imageProvided) {
            newImageKey = await uploadFileToS3(req, res, req.file, AWSFieldName)
            if(!newImageKey) return res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu publier la nouvelle image." })
            else {
                item.image = newImageKey
                newImageUploaded = true

                //delete old image
                const oldImageDeleted = await deleteFileFromS3(req, res, oldImageKey)
                if(!oldImageDeleted) message += "Nous n'avons pas pu supprimer l'ancienne image. "
            }
        }

        //update item
        if(name) item.name = name
        if(public != null) item.public = public
        if(description) item.description = description
        await item.save()

        //respond
        return res.status(200).json({ message: "Item modifié avec succès. " + message })

    } catch (error) {
        logError( 'Error updating menu item', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu modifier l'item." })
        if(imageProvided && newImageUploaded && imageKey) { const imageDeleted = await deleteFileFromS3(req, res, newImageKey) }
    }
})
router.delete('/delete-item/:id', checkAuthorized, checkAdmin, async (req, res) => {
    const { id } = req.params
    if(!id) return res.status(400).json({ message: "ID d'item manqunat." })

    try {
        //check item
        const item = await itemModel.findById(id)
        if(!item) return res.status(404).json({ message: "Aucun item avec cet ID" })

        //delete image
        const imageDeleted = await deleteFileFromS3(req, res, item.image)
        if(!imageDeleted) return res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu supprimer l'image de l'item" })

        //delete record
        await itemModel.findByIdAndDelete(id)
        
        //respond
        return res.status(200).json({ message: "Item supprimé avec succès." })

    } catch (error) {
        logError( 'Error deleting menu item', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu supprimer l'item." }) 
    }
})


module.exports = router