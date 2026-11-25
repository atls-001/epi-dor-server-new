const mongoose = require('mongoose')

const staffMemberSchema = new mongoose.Schema(
    {
        public: { type: Boolean, default: true },
        featured: { type: Boolean, default: false },
        category: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff_Category', required: true  },
        image: { type: String }, 
        name: { type: String, required: true },
        position: { type: String, required: true },
        position: { type: String, required: true },
        description: { type: String, required: true }
    },
    { timestamps: true }
) 


const Staff_Member = mongoose.model('Staff_Member', staffMemberSchema)
module.exports = Staff_Member