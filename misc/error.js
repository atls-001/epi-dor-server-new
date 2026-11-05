function logError(message, error) {
    console.log('--------------------')
    console.log(message, error.message)
    console.log('-----')
    console.log(error)
    console.log('--------------------')
}


module.exports = { logError }