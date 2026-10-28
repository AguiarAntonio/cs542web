import "reflect-metadata";
import { DataSource } from "typeorm";

export const AppDataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "your_username",
    password: "your_password",
    database: "your_database_name",
    logging: true,
});

export async function connectDB() {
    try {
        await AppDataSource.initialize();
        console.log("Data Source has been initialized successfully!");
    } catch (err) {
        console.error("Error during Data Source initialization", err);
    }
}