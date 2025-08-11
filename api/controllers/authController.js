const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Login Controller
const loginUser = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ msg: 'User not found' });
    }

    // Compare entered password with the stored hashed password
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,  // Use the JWT_SECRET environment variable
      { expiresIn: '8h' }  // Token expiry time: 1 hour
    );

    // Send the token back to the client
    res.json({ msg: 'Login successful', token });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

module.exports = { loginUser };
