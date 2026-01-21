import { query } from "./db.js";

const rows = await query("SELECT 1");
console.log("DB OK:", rows);
