import express from "express";
import "dotenv/config";
import { query } from "./db.js";

const app = express();
app.use(express.json());

// Simple test route
app.get("/", async (req, res) => {
  const result = await query("SELECT 1");
  res.json({ message: "API works!", result });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
