const router = require('express').Router()
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
//context
const { logError } = require('../misc/error.js')
//multer requirements
const multer  = require('multer') 
const storage = multer.memoryStorage()
const upload = multer({ storage: storage }) 
//models
const categoryModel = require('../models/staffCategory-model')
const memberModel = require('../models/staffMember-model')


//auth middleware
const { checkAuthorized, checkAdmin, checkOwner } = require('../middleware/authMiddleware')


//aws
const AWSFieldName = 'staff_pictures'
const { uploadFileToS3, deleteFileFromS3 } = require('../middleware/awsMiddleware')


//public CRUD routes
router.get('/read-public-categories', async (req, res) => {
    try {
        const categories = await categoryModel.find({ public: true })
        return res.status(200).json(categories)

    } catch (error) {
        logError( 'Error readig public staff categories: ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu lire les catégories publiques." })
    }
})
router.get('/read-public-members', async (req, res) => {
    try {
        const members = await memberModel.find({ public: true })
        return res.status(200).json(members)
    } catch (error) {
        logError( 'Error readig public staff members: ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu lire les membres publiques." })
    }
})
router.get('/read-featured-members', async (req, res) => {
    try {
        const members = await memberModel.find({ public: true, featured: true })
        return res.status(200).json(members)
    } catch (error) {
        logError( 'Error readig featured staff members: ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu lire les membres en avant." })
    }
})


//categories admin CRUD routes
router.post('/create-category', checkAuthorized, checkAdmin, async (req, res) => {
    const { public, name, description } = req.body
    if(public == null || !name || !description) return res.status(400).json({ message: "Données manquantes" }) 

    try {
        //check name uniqueness
        const sameNameCategories = await categoryModel.find({ name })

        const newCategory = new categoryModel({ public, name, description })
        await newCategory.save() 
        return res.status(200).json({ message: "La catégorie a été créée avec succès." })

    } catch (error) {
        logError( 'Error creating staff category: ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu créer la catégorie de leadership." })
    }
})
router.get('/read-all-categories', checkAuthorized, checkAdmin, async (req, res) => {
    try {
        const categories = await categoryModel.find({})
        return res.status(200).json(categories)
    } catch (error) {
        logError( 'Error reading staff categories: ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu lire les catégories de leadership." })
    }
})
router.put('/update-category/:id', checkAuthorized, checkAdmin, async (req, res) => {
    const { id } = req.params
    if(!id) return res.status(400).json({ message: "Aucun ID de catégorie fournie." })

    //check body
    const { public, name, description } = req.body
    if(public == null || !name || !description) return res.status(400).json({ message: "Données manquantes" })

    try {
        //check record
        const category = await categoryModel.findById(id)
        if(!category) return res.status(404).json({ message: "Nous n'avons pas trouvé cette catégorie." })
            
        //update category
        if(public !== null) category.public = public
        if(name) category.name = name
        if(description) category.description = description
        await category.save()

        //respond
        return res.status(200).json({ message: "Catégorie modifiée avec succès." })

    } catch (error) {
        logError( 'Error updating staff category: ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu modifier la catégorie de leadership." })
    }
})
router.delete('/delete-category/:id', checkAuthorized, checkAdmin, async (req, res) => {
    const { id } = req.params
    if(!id) return res.status(400).json({ message: "Aucun ID de catégorie fournie." })

    try {
        //check record
        const category = await categoryModel.findById(id)
        if(!category) return res.status(404).json({ message: "Nous n'avons pas trouvé cette catégorie." })

        //delete members
        const membersOfCategory = await memberModel.find({ category: id })
        if(membersOfCategory.length > 0) {
            for(const member of membersOfCategory) {
                const memberDel = await deleteMember(req, res, member.id)
                if(!memberDel.deleted) return res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu supprimer l'un des membres de cette catégorie." })
            }
        }

        //delete record
        await categoryModel.findByIdAndDelete(id)
        return res.status(200).json({ message: "Catégorie supprimée avec succès." })

    } catch (error) {
        logError( 'Error deleting staff category: ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu supprimer la catégorie de leadership." })
    }
})


//members admin CRUD routes
router.post('/create-member', checkAuthorized, checkAdmin, upload.single('image'), async (req, res) => {
    const { public, featured, name, position, description, category } = req.body
    if(public == null || featured == null || !name || !position || !description || !category)
        return res.status(400).json({ message: "Donnée(s) manquante(s)." })

    //AWS failsafes
    let imageKey

    try {
        //upload image
        imageKey = await uploadFileToS3(req, res, req.file, AWSFieldName)
        if(!imageKey) return res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu publier l'image sur le cloud." })

        //create new record
        const newMember = new memberModel({
            public, featured, 
            name, category, position, description,
            image: imageKey
        })
        await newMember.save()

        //respond
        return res.status(200).json({ message: "Membre créé avec succès." })

    } catch (error) {
        if(imageKey) { const imgDeleted = await deleteFileFromS3(req, res, imageKey) }

        logError( 'Error creating staff member: ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu créer le membre de leadership." })
    }
})
router.get('/read-all-members', checkAuthorized, checkAdmin, async (req, res) => {
    try {
        const members = await memberModel.find({})
        return res.status(200).json(members)
    } catch (error) {
        logError( 'Error reading staff: ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu lire le staff." })
    }
})
router.put('/update-member/:id', checkAuthorized, checkAdmin, upload.single('image'), async (req, res) => {
    const { id } = req.params
    if(!id) return res.status(400).json({ message: "Aucun ID de membre fourni." })

    //check body
    const { public, featured, name, position, category, description } = req.body

    //AWS failsafe
    let imageKey
    let message = ''

    try {
        //check member
        const member = await memberModel.findById(id)
        if(!member) return res.status(404).json({ message: "Aucun membre avec cet ID trouvé." })

        //upload image
        if(req.file) {
            imageKey = await uploadFileToS3(req, res, req.file, AWSFieldName)
            if(!imageKey) message += "Nous n'avons pas pu publier l'image sur le cloud. " 
            else {
                //delete old file
                const oldFileDeleted = await deleteFileFromS3(req, res, member.image)
                if(!oldFileDeleted) message += "Nous n'avons pas pu supprimer l'ancienne photo. "
                //change new record
                member.image = imageKey
            }
        }

        //update text fields
        if(public !== null) member.public = public
        if(featured !== null) member.featured = featured
        if(name) member.name = name
        if(position) member.position = position
        if(category) member.category = category
        if(description) member.description = description
        await member.save()

        //respond
        return res.status(200).json({ message: "Membre modifié avec succès. " + message })

    } catch (error) {
        logError( 'Error updating staff member: ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu modifier le membre." })
    }
})
async function deleteMember(req, res, id) {
    //check member
    const member = await memberModel.findById(id) 
    if(!member) return { deleted: false, message: "Aucun membre avec cet ID trouvé.", code: 404 }

    //delete image 
    const imageDeleted = await deleteFileFromS3(req, res, member.image)
    if(!imageDeleted) return { deleted: false, message: "Erreur backend: Nous n'avons pas pu supprimer la photo du membre sur le cloud.", code: 500}

    //delete record
    const recordDeleted = await memberModel.findByIdAndDelete(id)
    if(!recordDeleted) return { deleted: false, message: "Erreur backend: Nous n'avons pas pu supprimer le membre.", code: 500}

    //all is well, return true
    return { deleted: true, message: null, code: 200 }
}
router.delete('/delete-member/:id', checkAuthorized, checkAdmin, async (req, res) => {
    const { id } = req.params 
    if(!id) return res.status(400).json({ message: "Aucun ID de membre foruni." })

    try {
        const result = await deleteMember(req, res, id)
        if(result.deleted) return res.status(200).json({ message: "Le message a été supprimé avec succès." })
        else return res.status(result.code).json({ message: result.message })

    } catch (error) {
        logError( 'Error deleting staff member : ', error )
        res.status(500).json({ message: "Erreur backend: Nous n'avons pas pu supprimer le membre du staff." })
    }
})


module.exports = router