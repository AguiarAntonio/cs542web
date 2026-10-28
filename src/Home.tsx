import './Home.css'
import {type ChangeEvent, useState, useEffect } from 'react'




function Home() {

    const [id, setId] = useState(0)

    const [recipe, setRecipe] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('http://localhost:5000/api/recipe')
            .then(res => res.json())
            .then((data) => {
                setRecipe(data);
                setLoading(false);
            })
            .catch((error) => {
                console.error('Error fetching data:', error);
                setLoading(false);
            });
    }, []);


    const changeID = (e: ChangeEvent<HTMLInputElement>) => {
        const intVal = Number(e.target.value)

        setId(intVal)
    }

    const handleChangeID = (e: ChangeEvent<HTMLFormElement>) => {
        e.preventDefault()
        console.log(id)
    }

    if (loading) return <p>Loading</p>

    return (
        <>
            <form onSubmit={handleChangeID}>
                <label htmlFor={"ID"}>Recipe ID:</label>
                <input type="number" id="ID" onChange={changeID} name="ID" value={id} />

                <button type="submit">Submit</button>
            </form>
            <div>
                <h2>Recipe list:</h2>
                {recipe.map((recipe) => (
                    <div key={recipe.name}>{recipe.name} - {recipe.recipe_id}</div>
                ))}
            </div>
        </>
    )
}

export default Home