const mongoose = require('mongoose')

const staffCategorySchema = new mongoose.Schema(
    {
        public: { type: Boolean, default: true },
        name: { type: String, required: true, unique: true },
        description: { type: String, required: true }
    },
    { timestamps: true }
) 


const Staff_Category = mongoose.model('Staff_Category', staffCategorySchema)
module.exports = Staff_Category