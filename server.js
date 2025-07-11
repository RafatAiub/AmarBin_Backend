// server.js
const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");

dotenv.config();

const app = express();
const server = http.createServer(app); // Use HTTP for standard deployment
const io = socketIo(server, {
  cors: {
    origin: "*", // Optional: restrict in production
    methods: ["GET", "POST"],
  },
});

// 📡 Make io accessible from everywhere via app.set()
app.set("io", io);

// Socket listener
io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id);
});

// Middleware
app.use(express.json());
app.use(cors());

// Swagger route
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Route imports
app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/pickups", require("./routes/pickups"));

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err.message));

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
