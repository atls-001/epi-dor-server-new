const router = require('express').Router()
const { logError } = require('../misc/error')


//auth middleware
const { checkAuthorized, checkUnauthorized, checkAdmin, checkOwner } = require('../middleware/authMiddleware') 


//AWS middleware
const { getPresignedUrl, uploadFileToS3, deleteFileFromS3 } = require('../middleware/awsMiddleware')
//AWS routes
router.get('/get-public-img-url/*key', async (req, res) => { 
    const rawKey = req.params.key
    const key = Array.isArray(rawKey) ? rawKey.join('/') : rawKey
    if(!key) return res.status(400).json({ message: "No image key provided for signed URL" })

    try {
        const url = await getPresignedUrl(key)
        return res.status(200).json(url)
        
    } catch(error) {
        logError( `Error getting signed URL for ${key} image : `, error )
        res.status(500).json({ message: `Backend error: Couldn't get signed URL for ${key} image :` })
    }
})

module.exports = router