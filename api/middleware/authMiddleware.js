const jwt = require("jsonwebtoken");

// Middleware to protect routes
const protect = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ msg: "No token, authorization denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ msg: "Token is not valid" });
  }
};

const checkRole =
  (requiredRoles = []) =>
  (req, res, next) => {
    if (req.user && requiredRoles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({
        msg: `Access denied. Requires ${requiredRoles.join(" , ")} role.`,
      });
    }
  };

// 3. Authorization Middleware (Check Permission) - Checks if user has a specific permission
const checkPermission = (requiredPermission) => (req, res, next) => {
  // Permissions are stored in req.user.permissions array (from token payload)
  if (req.user && req.user.permissions.includes(requiredPermission)) {
    next();
  } else {
    res.status(403).json({
      msg: `Access denied. Requires permission: ${requiredPermission}.`,
    });
  }
};

module.exports = { protect, checkPermission, checkRole };
