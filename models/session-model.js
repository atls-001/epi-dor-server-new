const mongoose = require('mongoose')

const sessionSchema = new mongoose.Schema(
    {
        sessionId: {
            type: String,
            required: true,
        },
        pages: {
            type: [String],
            required: true,
            default: []
        }, 
    },
    { timestamps: true }
) 

const Session = mongoose.model('Session', sessionSchema)
module.exports = Session