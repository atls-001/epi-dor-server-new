const mongoose = require('mongoose')

const menuCategorySchema = new mongoose.Schema(
    {
        name: {
            type: String, 
            required: true, unique: true
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

const MenuCategory = mongoose.model('MenuCategory', menuCategorySchema)
module.exports = MenuCategory