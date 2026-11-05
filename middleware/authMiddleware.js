const jwt = require('jsonwebtoken') 
const userModel = require('../models/user-model')
const refreshTokenModel = require('../models/refreshToken-model')
const jwtExpires = 3 //also exists in auth router, please keep a match


async function checkAuthorized(req, res, next) {  
    //get the token
    const token = req.cookies.accessToken   

    //the token that'll actually be used
    let actualToken

    //veryfy the token & handle expiry
    let decodedToken 
    try { 
        decodedToken = jwt.verify(token, process.env.JWT_SECRET)
        actualToken = decodedToken 
    } catch (error) {
        //token has expired
        if(error.name === 'TokenExpiredError') {
            //get refresh token
            const refreshToken = req.cookies.refreshToken
            if(!refreshToken) return res.status(403).json({ message: "Failure to get refresh token" }) 

            //check refresh token is currently saved 
            const RFTInDB = await refreshTokenModel.findOne({ token: refreshToken })
            if(!RFTInDB) return res.status(403).json({ message: "Failure to find refresh token in DB" })
            
            //verify refresh token
            let decodedRefreshToken
            try { decodedRefreshToken = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET) }
            catch(error) { return res.status(403).json({ message: "Refresh token failed verification" })   } 

            //generate new access token
            const newToken = jwt.sign(
                { iss: 'atlasoft backend', sub: decodedRefreshToken.sub, rank: decodedRefreshToken.rank }, 
                process.env.JWT_SECRET,
                { expiresIn: `${jwtExpires}m` }
            ) 
            if(!newToken) return res.status(400).json({ message: "failed to generate new access token" })
                
            //send new access token to client
            res.cookie("accessToken", newToken, {
                httpOnly: true,      // can’t be accessed by JS
                secure: true,
                sameSite: "none",  // prevents CSRF in most cases 
            })   
            //update request with new token
            req.cookies.accessToken = newToken

            //set actual token
            actualToken = jwt.decode(newToken)
        }
        //token doesn't verify at all
        else return res.status(403).json({ message: "Not authorized" }) 

    } 
    
    //token verifies
    try {
        const user = await userModel.findById(actualToken.sub) 
        if(!user) return res.status(404).json({ message: "Couldn't get user for authorization check." })
        req.user = user
        return next()
    } catch(error) {
        console.log("Error checking authorization: ", error)
        return res.status(400).json({ message: "Authorization check failed." })
    }  
}
async function checkUnauthorized(req, res, next) {
    //get the token
    const token = req.cookies.accessToken
    if(!token) return next() 

    //veryfy the token
    let decodedToken
    try { 
        decodedToken = jwt.verify(token, process.env.JWT_SECRET)
        const user = await userModel.findById(decodedToken.sub)
        if(!user) return next()
        return res.status(400).json({ message: "You are already authenticated" })
    }
    catch(error) { return next() }  
    if(decodedToken) return res.status(400).json({ message: "You are already authenticated" })

    next()
}

const authFailMessage = "You are not authorized for this operation"
async function checkAdmin(req, res, next) {
    //get the token
    const token = req.cookies.accessToken 
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET) 

    if(decodedToken.rank == 'admin' || decodedToken.rank == 'owner' || decodedToken.rank == 'developer') 
        return next()
    else return res.status(401).json({ message: authFailMessage })
}

async function checkOwner(req, res, next) {
    //get the token
    const token = req.cookies.accessToken 
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET) 

    if(decodedToken.rank == 'owner' || decodedToken.rank == 'developer') return next()
    else return res.status(401).json({ message: authFailMessage })
}

module.exports = { checkAuthorized, checkUnauthorized, checkAdmin, checkOwner }