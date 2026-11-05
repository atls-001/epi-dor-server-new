const mongoose = require('mongoose')

const locationSchema = new mongoose.Schema(
    { 
        public: {
            type: Boolean,
            required: true, default: true
        },
        featured: {
            type: Boolean,
            required: true, default: false
        },
        name: { type: String, required: true },
        address: { type: String, required: true },
        images: { type: [String], required: true }, 
        description: { type: String, required: true }, 
        mapLink: { type: String, required: true },  
    },
    { timestamps: true }
) 

const Location = mongoose.model('Location', locationSchema)
module.exports = Location