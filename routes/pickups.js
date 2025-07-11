const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { z } = require("zod");

const PickupRequest = require("../models/PickupRequest");
const auth = require("../middleware/auth");
const permit = require("../middleware/role");

// ---------------------------------------------
// 📝 Swagger tags predefined in swaggerSpec
/**
 * @swagger
 * tags:
 *   - name: Pickups
 *     description: Endpoints for managing pickup requests
 */

// ---------------------------------------------
/**
 * @swagger
 * components:
 *   schemas:
 *     PickupRequest:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         phone:
 *           type: string
 *         address:
 *           type: string
 *         customerId:
 *           type: string
 *         assignedTo:
 *           type: string
 *         status:
 *           type: string
 *           enum: [pending, assigned, completed]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         pickedUpAt:
 *           type: string
 *           format: date-time
 *       example:
 *         _id: "612345abcdef"
 *         name: "John Doe"
 *         phone: "0123456789"
 *         address: "123 Green Road, Dhaka"
 *         customerId: "601234abcdabcd"
 *         assignedTo: "602345bcdefghi"
 *         status: "pending"
 *         createdAt: "2025-07-06T12:00:00.000Z"
 *         pickedUpAt: null
 */

// 🟢 1. Create Pickup — Public or Authenticated
/**
 * @swagger
 * /pickups:
 *   post:
 *     summary: Create a new pickup request
 *     tags: [Pickups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       description: Provide phone, address, and optional name; authenticated users auto‑link their ID
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, address]
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *             example:
 *               name: "John Doe"
 *               phone: "017xxxxxxxx"
 *               address: "123 Dhaka St"
 *     responses:
 *       201:
 *         description: Created pickup request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/PickupRequest"
 *       400:
 *         description: Invalid request payload
 */
router.post("/", async (req, res) => {
  const schema = z.object({
    name: z.string().optional(),
    phone: z.string().min(5),
    address: z.string().min(5),
  });

  try {
    const { name, phone, address } = schema.parse(req.body);
    const pickupData = { name, phone, address };

    if (req.headers.authorization) {
      const token = req.headers.authorization.replace("Bearer ", "");
      const { id } = jwt.verify(token, process.env.JWT_SECRET);
      pickupData.customerId = id;
    }

    const newPickup = await PickupRequest.create(pickupData);
    req.app.get("io").emit("newPickup", newPickup);
    res.status(201).json(newPickup);
  } catch (err) {
    console.error("❌ Pickup submission failed:", err.message);
    res.status(400).json({ message: err.message || "Invalid request" });
  }
});

// 🟢 2. Get Pickups Based on Role — Authenticated
/**
 * @swagger
 * /pickups:
 *   get:
 *     summary: Get pickup requests visible to the user
 *     tags: [Pickups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pickup requests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/PickupRequest"
 */
router.get("/", auth, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === "customer") filter.customerId = req.user._id;
    else if (req.user.role === "employee") filter.assignedTo = req.user._id;

    const pickups =
      req.user.role === "admin"
        ? await PickupRequest.find().populate("customerId assignedTo")
        : await PickupRequest.find(filter);

    res.json(pickups);
  } catch (err) {
    console.error("❌ Fetching pickups failed:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// 🟢 3. Get All Pickups (Admin Only)
/**
 * @swagger
 * /pickups/all:
 *   get:
 *     summary: Admin-only: list all pickup requests
 *     tags: [Pickups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Full list of pickups including details
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/PickupRequest"
 *       403:
 *         description: User lacks admin privileges
 */
router.get("/all", auth, permit("admin"), async (req, res) => {
  try {
    const pickups = await PickupRequest.find().populate("customerId assignedTo");
    res.json(pickups);
  } catch (err) {
    console.error("❌ Fetching all pickups failed:", err.message);
    res.status(500).json({ message: "Failed to fetch all pickups" });
  }
});

// 🟢 4. Assign Pickup — Admin Only
/**
 * @swagger
 * /pickups/assign:
 *   post:
 *     summary: Assign a pickup to an employee (Admin only)
 *     tags: [Pickups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       description: Provide pickupId and employeeId
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pickupId, employeeId]
 *             properties:
 *               pickupId:
 *                 type: string
 *               employeeId:
 *                 type: string
 *             example:
 *               pickupId: "612345abcdef"
 *               employeeId: "602345bcdefghi"
 *     responses:
 *       200:
 *         description: Pickup contract updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/PickupRequest"
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Pickup not found
 *       403:
 *         description: Access denied (not admin)
 */
router.post("/assign", auth, permit("admin"), async (req, res) => {
  const schema = z.object({ pickupId: z.string(), employeeId: z.string() });
  try {
    const { pickupId, employeeId } = schema.parse(req.body);
    const pickup = await PickupRequest.findById(pickupId);
    if (!pickup) return res.status(404).json({ message: "Pickup not found" });

    pickup.status = "assigned";
    pickup.assignedTo = employeeId;
    await pickup.save();

    req.app.get("io").emit("assignedPickup", { id: pickupId, employeeId });
    res.json(pickup);
  } catch (err) {
    console.error("❌ Assign error:", err.message);
    res.status(400).json({ message: err.message || "Assign failed" });
  }
});

// 🟢 5. Complete Pickup — Admin & Employee
/**
 * @swagger
 * /pickups/complete/{id}:
 *   post:
 *     summary: Mark a pickup as completed (Employee/Admin)
 *     tags: [Pickups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Pickup ID
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pickup marked completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/PickupRequest"
 *       403:
 *         description: User not authorized to complete
 *       404:
 *         description: Pickup not found
 */
router.post(
  "/complete/:id",
  auth,
  permit("employee", "admin"),
  async (req, res) => {
    try {
      const pickup = await PickupRequest.findById(req.params.id);
      if (!pickup) return res.status(404).json({ message: "Pickup not found" });

      if (
        req.user.role === "employee" &&
        (!pickup.assignedTo ||
          !pickup.assignedTo.equals(req.user._id))
      ) {
        return res.status(403).json({ message: "Not authorized to complete" });
      }

      pickup.status = "completed";
      pickup.pickedUpAt = new Date();
      await pickup.save();

      req.app.get("io").emit("completedPickup", { id: pickup._id });
      res.json(pickup);
    } catch (err) {
      console.error("❌ Complete error:", err.message);
      res.status(400).json({ message: err.message || "Completion failed" });
    }
  }
);

module.exports = router;
