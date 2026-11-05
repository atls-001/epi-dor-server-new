const mongoose = require('mongoose')

const refreshTokenSchema = new mongoose.Schema(
    {
        token: {
            type: String,
            required: true, 
        }, 
    },
    { timestamps: true }
) 


const Refresh_token = mongoose.model('Refresh_token', refreshTokenSchema)
module.exports = Refresh_token