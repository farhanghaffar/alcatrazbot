const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Login Controller
const loginUser = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username }).populate("role"); // Populate the role details

    if (user && (await user.matchPassword(password))) {
      // Prepare permissions as a simplified array for the token
      const permissions = user.role.permissions.map((p) => p.name);

      // Generate token with role and permissions
      const token = jwt.sign(
        {
          id: user._id,
          role: user.role.name,
          permissions: permissions, // Embed permissions here
        },
        process.env.JWT_SECRET,
        { expiresIn: "30d" }
      );

      res.json({
        _id: user._id,
        username: user.username,
        role: user.role.name,
        token: token,
      });
    } else {
      res.status(400).json({ msg: "Invalid credentials" });
    }
  } catch (error) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

module.exports = { loginUser };
