const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { z } = require("zod");

const auth = require("../middleware/auth");
const permit = require("../middleware/role");

const User = require("../models/User");
const PickupRequest = require("../models/PickupRequest");

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin-only control panel
 */

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: List all users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of user objects
 */
router.get("/users", auth, permit("admin"), async (req, res) => {
  const users = await User.find().select("-passwordHash");
  res.json(users);
});

/**
 * @swagger
 * /admin/users:
 *   post:
 *     summary: Create a new user (with role)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, employee, customer]
 *     responses:
 *       201:
 *         description: Created user
 */
router.post("/users", auth, permit("admin"), async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(["admin", "employee", "customer"]),
  });
  const { name, email, password, role } = schema.parse(req.body);

  if (await User.findOne({ email })) {
    return res.status(400).json({ message: "Email already exists" });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, role });
  res.status(201).json({ id: user._id, name, email, role });
});

/**
 * @swagger
 * /admin/users/{id}:
 *   put:
 *     summary: Update user info
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated user data
 */
router.put("/users/:id", auth, permit("admin"), async (req, res) => {
  const { id } = req.params;
  const schema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
  });
  const data = schema.parse(req.body);
  const user = await User.findByIdAndUpdate(id, data, { new: true }).select(
    "-passwordHash"
  );
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
});

/**
 * @swagger
 * /admin/users/{id}/role:
 *   patch:
 *     summary: Change a user’s role
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [admin, employee, customer]
 *     responses:
 *       200:
 *         description: Role updated
 */
router.patch("/users/:id/role", auth, permit("admin"), async (req, res) => {
  const { id } = req.params;
  const { role } = z
    .object({ role: z.enum(["admin", "employee", "customer"]) })
    .parse(req.body);
  const user = await User.findByIdAndUpdate(id, { role }, { new: true }).select(
    "-passwordHash"
  );
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ id: user._id, role: user.role });
});

/**
 * @swagger
 * /admin/users/{id}:
 *   delete:
 *     summary: Delete a user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted user
 */
router.delete("/users/:id", auth, permit("admin"), async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ message: "User deleted" });
});

/**
 * @swagger
 * /admin/pickups/{id}:
 *   delete:
 *     summary: Delete a pickup request
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The ID of the pickup request to delete
 *         schema:
 *           type: string
 *           example: 664acb5e7f103e8c1d054fab
 *     responses:
 *       200:
 *         description: Pickup deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Pickup request deleted
 *       404:
 *         description: Pickup not found
 *       500:
 *         description: Server error
 */
router.delete("/pickups/:id", auth, permit("admin"), async (req, res) => {
  try {
    const deleted = await PickupRequest.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Pickup not found" });
    }
    res.json({ message: "Pickup request deleted" });
  } catch (err) {
    console.error("❌ Deletion error:", err.message);
    res.status(500).json({ message: "Deletion failed" });
  }
});

/**
 * @swagger
 * /admin/pickups/{id}:
 *   put:
 *     summary: Edit any pickup request
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated pickup
 */
// 📌  [Admin] Edit/update pickup request info
router.put("/:id", auth, permit("admin"), async (req, res) => {
  const schema = z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    status: z.enum(["pending", "assigned", "completed"]).optional(),
    assignedTo: z.string().optional(),
  });

  try {
    const data = schema.parse(req.body);
    const updated = await PickupRequest.findByIdAndUpdate(req.params.id, data, {
      new: true,
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
