//AWS requirements
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3")
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner")


//AWS S3 setup 
const s3Client = new S3Client({
    credentials: {
        accessKeyId: process.env.AWS_IAM_ACCESS_KEY,
        secretAccessKey: process.env.AWS_IAM_SECRET_KEY
    },
    region: process.env.AWS_S3_REGION,

})


//middleware functions
async function getPresignedUrl(fileKey) { 
    const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_NAME,
        Key: fileKey,
    })
    
    // URL expires in 3600 seconds (1 hour)
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return url
}

async function uploadFileToS3(req, res, file, folderName) {
    //create randomized file name
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const fileExtension = file.originalname.split('.').pop()
    const uniqueFileName = `${folderName}/${uniqueSuffix}.${fileExtension}`
    
    //create upload parameters
    const params = {
        Bucket: process.env.AWS_S3_NAME,
        Key: uniqueFileName, 
        Body: file.buffer,
        ContentType: file.mimetype
    }
  
    //uploat to s3 bucket
    try {
        const uploadCommand = new PutObjectCommand(params)
        await s3Client.send(uploadCommand)
    } catch (error) {
        console.log("Error uploading file to AWS S3 bucket: ", error)
        res.status(400).json({ message: "Backend error: Couldn't upload Picture to S3 bucket, operation cancelled." })
        return null // Return null on failure
    }
    
    //assemble and return the public URL  
    const fileUrl = uniqueFileName 
    return fileUrl
}

async function deleteFileFromS3(req, res, fileKey) {
    // Create deletion parameters
    const params = { Bucket: process.env.AWS_S3_NAME, Key: fileKey }

    try {
        const deleteCommand = new DeleteObjectCommand(params)
        await s3Client.send(deleteCommand)
        return true
    } catch (error) {
        console.log("Error deleting file from AWS S3 bucket: ", error); 
        return false
    }
}

module.exports = { getPresignedUrl, uploadFileToS3, deleteFileFromS3 }