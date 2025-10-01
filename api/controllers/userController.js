// api/controllers/userController.js
const User = require("../models/User");
const Role = require("../models/Role");

const createUser = async (req, res) => {
  const { username, password, roleName } = req.body;

  const userExists = await User.findOne({ username });

  if (userExists) {
    return res.status(400).json({ msg: "User already exists" });
  }

  const role = await Role.findOne({ name: roleName || "Processor" });

  if (!role) {
    return res.status(404).json({ msg: `Role ${roleName} not found` });
  }

  const user = await User.create({
    username,
    password,
    role: role._id, // Assign the ObjectId of the role
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      username: user.username,
      role: role.name,
    });
  } else {
    res.status(400).json({ msg: "Invalid user data" });
  }
};

const getUsers = async (req, res) => {
  try {
    // Fetch users and populate the role to display the role name
    const users = await User.find({ isActive: true }).populate("role", "name"); // Only select the name field from the Role model

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

const updateRole = async (req, res) => {
  const { userId } = req.params;
  const { newRoleName } = req.body;

  if (!newRoleName) {
    return res.status(400).json({ msg: "New role name is required" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const newRole = await Role.findOne({ name: newRoleName });
    if (!newRole) {
      return res.status(404).json({ msg: `Role ${newRoleName} not found` });
    }

    user.role = newRole._id;
    await user.save();

    res.json({
      _id: user._id,
      username: user.username,
      role: newRole.name,
      msg: `Role updated to ${newRoleName}`,
    });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

module.exports = { createUser, getUsers, updateRole };
