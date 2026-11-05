const mongoose = require('mongoose')

const userSchema = new mongoose.Schema(
    {
        status: {
            type: String, required: true,
            default: "regular"
        },
        firstName: { type: String, required: true },
        lastName: { type: String, required: true }, 
        rank: { type: String, required: true, },
        fullName: { type: String },
        email: {
            type: String, required: true,
            unique: true
        }, 
        OTPInit: {
            type: Boolean, required: true,
            default: false
        },
        lastOTP: { type: Date },
        recoveryOut: {
            type: Boolean, required: true,
            default: false
        },
        recoveryCode: { type: String },
        password: { type: String, required: true }
    },
    { timestamps: true }
)


userSchema.pre('save', async function () {
    this.fullName = `${this.firstName} ${this.lastName}` 
})


const User = mongoose.model('User', userSchema)
module.exports = User