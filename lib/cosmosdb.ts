import { MongoClient } from "mongodb";
import { getActiveDatabase } from "@/lib/databaseManager";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const defaultConfig = {
    uri: process.env.DEFAULT_COSMOSDB_ENDPOINT || "",
    databaseId: process.env.DEFAULT_COSMOSDB_DATABASE || "",
    containerId: process.env.DEFAULT_COSMOSDB_CONTAINER || "",
    userCollection: process.env.DEFAULT_COSMOSDB_USER_COLLECTION || "",
    assignmentCollection: process.env.DEFAULT_COSMOSDB_ASSIGNMENT_COLLECTION || "",
    name: process.env.DEFAULT_DATABASE_NAME || "",
};

if (
    !defaultConfig.uri ||
    !defaultConfig.databaseId ||
    !defaultConfig.userCollection
) {
    throw new Error("Missing required environment variables for default database");
}

const clientPromises = new Map<string, Promise<MongoClient>>();

async function getMongoClient(uri: string): Promise<MongoClient> {
    let clientPromise = clientPromises.get(uri);

    if (!clientPromise) {
        clientPromise = (async () => {
            const mongoClient = new MongoClient(uri);

            try {
                await mongoClient.connect();
                return mongoClient;
            } catch (error) {
                await mongoClient.close().catch(() => {});
                throw error;
            }
        })();

        clientPromises.set(uri, clientPromise);

        clientPromise.catch(() => {
            if (clientPromises.get(uri) === clientPromise) {
                clientPromises.delete(uri);
            }
        });
    }

    return clientPromise;
}

export const getCollection = async () => {
    const activeDatabase = getActiveDatabase();

    if (!activeDatabase) {
        throw new Error("No active database set");
    }

    const mongoClient = await getMongoClient(activeDatabase.uri);

    return mongoClient
        .db(activeDatabase.databaseId)
        .collection(activeDatabase.containerId);
};

export const getUserCollection = async () => {
    const mongoClient = await getMongoClient(defaultConfig.uri);

    return mongoClient
        .db(defaultConfig.databaseId)
        .collection(defaultConfig.userCollection);
};

export const getDatabaseCollection = async () => {
    const mongoClient = await getMongoClient(defaultConfig.uri);

    return mongoClient
        .db(defaultConfig.databaseId)
        .collection(
            process.env.DEFAULT_COSMOSDB_DATABASE_COLLECTION || "databases"
        );
};

export const getAssignmentCollection = async () => {
    const mongoClient = await getMongoClient(defaultConfig.uri);

    return mongoClient
        .db(defaultConfig.databaseId)
        .collection(defaultConfig.assignmentCollection);
};