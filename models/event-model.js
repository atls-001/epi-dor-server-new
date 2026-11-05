const mongoose = require('mongoose')

const eventSchema = new mongoose.Schema(
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
        images: { type: [String], required: true },
        logo: { type: String },
        graphicType: { type: String, required: true },
        titleType: { 
            type: String, 
            required: true, default: 'text' 
        }, 
        description: { type: String, required: true },
        start: { type: Date },
        end: { type: Date, required: true },
    },
    { timestamps: true }
) 

const Event = mongoose.model('Event', eventSchema)
module.exports = Event