const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define the user schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },  // The password will be hashed before saving
});

// Hash the password before saving to the database
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();  // Check if password is modified

  // If the password is modified, hash it
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare entered password with the stored hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  // Compare entered password with the stored hashed password
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
