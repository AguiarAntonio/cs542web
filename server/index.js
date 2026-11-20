import express from 'express';
import pg from 'pg';
import cors from 'cors';
import 'dotenv/config';

const app = express();
const { Pool } = pg
const PORT = 5000;
app.use(cors({ origin: 'http://localhost:5000'}))
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



// Get Recipes
// ---------------------------------------------------------------------
app.get("/api/recipeMetaByID", async (req, res) => {
    try {
        const ids = req.query.ids.split(",");
        const result = await pool.query(
            `SELECT * FROM recipe WHERE Recipe_ID = ANY($1)`,
            [ids]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});

app.get("/api/recipeComponentsByID/:id", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT DISTINCT Name, unitname, qnt 
                    FROM Ingredients
                    NATURAL JOIN (SELECT Ing_ID, unitname, qnt 
                            FROM Recipe NATURAL JOIN Components 
                            WHERE Recipe_ID = $1 
                            ORDER BY Display_Order ASC) as Ing 
                        NATURAL JOIN RAW_Ingredients_names 
            WHERE qnt IS NOT NULL 
            UNION 
            SELECT DISTINCT name, unitname, qnt 
            FROM Recipe 
            INNER JOIN (SELECT ing_id, unitname, qnt 
                            FROM Recipe NATURAL JOIN Components 
                            WHERE Recipe_ID = $1 
                            ORDER BY Display_Order ASC) as Ing 
                ON recipe.ingredient_id = Ing.ing_id`,
            [req.params.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});
// ---------------------------------------------------------------------


// Filters and Search
// ---------------------------------------------------------------------
//show all Tags, the app should make a drop-down of check boxes
app.get("/api/tags", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT DISTINCT tag FROM recipetags ORDER BY tag ASC`,
            [],
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});



//show all Restrictions, the app should make a drop-down of check boxes for each kind
app.get("/api/restrictions", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT restriction.kind, ARRAY_AGG(restriction.name) 
                FROM restriction 
                GROUP BY restriction.kind 
                ORDER BY restriction.kind ASC`,
            [],
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});





app.get("/api/recipeFilter", async (req, res) => {
    try {
        const searchText = req.query.search || "";
        const tags = req.query.tag ? req.query.tag.split(",") : null;
        const restrictions = req.query.restrictions ? req.query.restrictions.split(",") : null;
        const ingredients = req.query.ingredients ? req.query.ingredients.split(",") : null;
        //console.log(searchText);
        //console.log(tags);
        //console.log(restrictions);
        const result = await pool.query(
            `SELECT R.recipe_id
             FROM recipe R
             WHERE
                 (
                     $1::text[] IS NULL
                     OR EXISTS (
                         SELECT 1
                         FROM recipetags T
                         WHERE T.recipe_id = R.recipe_id
                         AND T.tag = ANY($1::text[])
                     )
                 )
                 AND (
                     $2::text IS NULL
                     OR R.name ILIKE '%' || $2::text || '%'
                 )
                AND (
                    $4::int[] IS NULL
                    OR NOT EXISTS (
                        SELECT 1
                        FROM components C
                        WHERE C.recipe_id = R.recipe_id AND C.ing_id = ANY($4::int[])
                 )
                 )
                 AND (
                     $3::text[] IS NULL
                     OR NOT EXISTS (
                         SELECT 1
                         FROM components C
                         JOIN ingredient_conflict IC
                             ON C.ing_id = IC.ing_id
                         WHERE C.recipe_id = R.recipe_id
                         AND IC.restriction = ANY($3::text[])
                     )
                 )
             ORDER BY R.name ASC`,
            [tags,"%"+searchText+"%",restrictions,ingredients],
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});

// ---------------------------------------------------------------------


// pantry stuff
// ---------------------------------------------------------------------
app.get("/api/inPantry", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT pantry_name AS \"Pantry Name\", name as \"Item\" 
                From raw_ingredients_names
                join pantry_has on raw_ingredients_names.ing_id=pantry_has.ing_id`
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});

app.get("/api/recipeInPantry/:name", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT recipe_id 
             FROM components 
             GROUP BY recipe_id 
             HAVING COUNT(*) = COUNT(*) FILTER ( 
                 WHERE ing_id IN (SELECT ing_id FROM pantry_has WHERE pantry_name = $1) 
                 )`,
            [req.params.name]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});

app.get("/api/recipeInPantryPercentage/:name", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                 Recipe_ID, 
                 ROUND( 
                         COUNT(*) FILTER ( 
                         WHERE c.ing_id IN ( 
                             SELECT ing_id 
                             FROM pantry_has 
                             WHERE pantry_name = $1 
                         ) 
                     ) * 100.0 / COUNT(*), 
                         2 
                 ) AS percentage_available 
             From components c 
             GROUP BY c.Recipe_ID 
             ORDER BY percentage_available DESC`,
            [req.params.name]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});
// ---------------------------------------------------------------------





app.get("/api/recursiveRecipeComponentsByID/:id", async (req, res) => {
    try {
        const result = await pool.query(
            `WITH RECURSIVE dependency_tree AS ( 
                     SELECT 
                         d.qnt, 
                         d.unitname, 
                         d.Item, 
                         d.Needs 
              
                     FROM (SELECT Recipe.ingredient_ID as Item, Components.Ing_ID as Needs, components.unitname, components.qnt 
                     From recipe NATURAL JOIN components) d 
                     WHERE Item = (Select recipe.ingredient_id FROM recipe WHERE recipe_id = $1) 
              
                     UNION ALL 
              
                     SELECT 
                         p.qnt, 
                         p.unitname, 
                         p.Item, 
                         p.Needs 
              
                     FROM dependency_tree current 
                     JOIN (SELECT Recipe.ingredient_ID as Item, Components.Ing_ID as Needs, components.unitname, components.qnt 
                                    From recipe NATURAL JOIN components) p 
                     On p.Item = current.Needs 
                 ) 
                 SELECT g.qnt, g.unitname, R.ing_id From 
                 (SELECT d.* FROM dependency_tree d 
                 WHERE NOT EXISTS ( 
                     SELECT 1 
                     FROM ( 
                         SELECT Recipe.ingredient_ID AS Item,Components.Ing_ID AS Needs 
                         FROM recipe 
                         NATURAL JOIN components 
                     ) p 
                     WHERE p.Item = d.Needs 
                 )) AS g join 
                     (SELECT Ing_ID, Name FROM ( 
                      SELECT *, 
                             ROW_NUMBER() OVER ( 
                                 PARTITION BY Ing_ID 
                                 ORDER BY Name 
                                 ) AS rn 
                      FROM RAW_Ingredients_names 
                  ) AS ranked 
             WHERE rn = 1) R on r.ing_id=g.Needs;`,
            [req.params.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});


app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
})

