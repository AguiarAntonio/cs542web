import express from 'express';
import pg from 'pg';
import cors from 'cors';
import 'dotenv/config';

const app = express();
const { Pool } = pg

app.use(cors({ origin: 'http://localhost:5173'}))
app.use(express.json());

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE,
});

app.get("/api/recipe", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM recipe");
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});

app.get("/api/recipeByID", async (req, res) => {
   try {
       const result = await pool.query("SELECT * FROM recipe WHERE ID = ?");
       res.json(result.rows);
   } catch (error) {
       console.error(error);
       res.status(500).send("Server Error");
   }
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
})

