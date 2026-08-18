// this code is used to connect to the CosmosDB instance and get the collections
// note that you can not use the SQL API to query the data, you need to use the MongoDB API
// to do so, you need to use the MongoDB Node.js driver

import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const uri = process.env.COSMOSDB_ENDPOINT || "";
const databaseId = process.env.COSMOSDB_DATABASE || "";
const containerId = process.env.COSMOSDB_CONTAINER || "";
const userCollection = process.env.COSMOSDB_USER_COLLECTION || "";

// if (!uri || !databaseId || !containerId || !userCollection) {
//   throw new Error("Missing required environment variables");
// }

// Use a single client instance
let client: MongoClient | null = null;

const getClient = async () => {
  if (!client) {
    const newClient = new MongoClient(uri);
    try {
      await newClient.connect();
      client = newClient;
    }
    catch (error) {
      console.log("error: ", error);
      throw error
    }
  }
  return client
};

export const getCollection = async () => {
  try {
    const mongoClient = await getClient();
    const database = mongoClient.db(databaseId);
    const collection = database.collection(containerId);
    return collection;
  } catch (error) {
    console.error("Failed to get collection:", error);
    throw error;
  }
};

export const getUserCollection = async () => {
  try {
    const mongoClient = await getClient();
    const database = mongoClient.db(databaseId);
    const collection = database.collection(userCollection);
    return collection;
  } catch (error) {
    console.error("Failed to get user collection:", error);
    throw error;
  }
};
