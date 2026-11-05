const mongoose = require('mongoose')

const menuItemSchema = new mongoose.Schema(
    {
        category: {
            type: mongoose.Schema.Types.ObjectId, ref: 'MenuCategory', 
            required: true
        },
        name: {
            type: String, 
            required: true, unique: true
        },
        description: {
            type: String,
            required: true
        },
        image: {
            type: String, 
            required: true, unique: true
        },
        public: {
            type: Boolean, default: true
        }
    },
    { timestamps: true }
) 

const MenuItem = mongoose.model('MenuItem', menuItemSchema)
module.exports = MenuItem