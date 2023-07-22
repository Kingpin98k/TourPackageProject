const mongoose = require('mongoose')
const validator = require('validator')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

//Creating The Schema
const userSchema = new mongoose.Schema({
    name:{
        type:String,
        required:[true,"A User Must Have a Name"]
    },
    email:{
        type:String,
        required:[true,"Email is Required"],
        unique:true,
        lowercase:true,
        validate:[validator.isEmail,'Please Provide a Valid Email !']
    },
    photo:String,   //The uploaded Photo will be stored in outfile-system and the path to that photo will be stored in Photo field
    password:{
        type: String,
        required: [true, 'A strong Password Is a Must'],
        minlength:8,
        select:false
    },
    confirmPassword:{
        type: String,
        required: [true, 'Please Confirm the Password'],
        //This validator will only work on SAVE and CERATE and that is why we will need to update the user Using the save method
        validate:{
            validator:function(el){
                return el===this.password;
            },
            message:"Passwords are Not the Same !"
        }
    },
    passwordChangedAt:Date,
    passwordResetToken:String,
    passwordResetExpires:Date
})

//Using MongooseMiddleware to Encrypt the password Before Saving it...
userSchema.pre('save',async function(next){  //also known as mongooseHook
    //Checking if the password filed is mofified or not before encrypting it (the save can also be cleed when email is changed !!)    
    if(!this.isModified("password")) return next(); //returning after calling the next middleware
    
    //using the async hash function to hash the password
    this.password = await bcrypt.hash(this.password,12);
    //removing confirm_password field from the document
    this.confirmPassword=undefined;
    next();
})

//An Instance method that will be available in all the documents of user model
userSchema.methods.comparePasswords = async function (candidatePassword,userPassword){
    //We cannot use this.password since it is not selected
    return await bcrypt.compare(candidatePassword,userPassword)
}

//An Instance method to check if the password was changed after logging in so we should no allow access before logging In again
userSchema.methods.isPasswordChangedAfter = function(jwt_creation_time){
    if(this.passwordChangedAt){
        const password_changed_time = parseInt(this.passwordChangedAt.getTime()/1000,10);  //getTime() to convert given date to ms
        return jwt_creation_time < password_changed_time;
    }
    return false;
}

//An Instance method for creating random tokens for Password Reset
userSchema.methods.generateResetToken = function(){
    //Creating the token(Standard Procedure)
    const unencryptedResetToken = crypto.randomBytes(32).toString('hex')
    const encryptedResetToken = crypto.hash('sha256').update(unencryptedResetToken).digest('hex')
    
    //These will not be fully saved until user.save() is called
    //Saving to DB
    //Reset Token
    this.passwordResetToken = encryptedResetToken
    //Expires In
    this.passwordResetExpires = Date.now()+10*60*1000  //To convert 10mins to milliseconds
    //Returning the newely created token to be given to user
    return unencryptedResetToken
}

//Creating the Model Out of the Schema
const User = mongoose.model("User",userSchema)

//Exporting the model
module.exports = User