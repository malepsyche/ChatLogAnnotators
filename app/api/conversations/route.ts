import { NextResponse } from "next/server";
import { getCollection } from "@/lib/cosmosdb";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const collection = await getCollection();
    const documents = await collection.find({}).toArray();
    console.log("documents", documents)
    const userAccessGroup = (await cookies()).get("userAccessGroup")?.value;
    // console.log("accessGroup", accessGroup)
    const filteredDocuments = documents.filter((doc) => doc.accessGroups?.includes(userAccessGroup))   
    // console.log("filteredDocuments", filteredDocuments)

    const conversations = filteredDocuments.map((doc) => ({
      _id: doc._id.toString(),
      person: doc.person || "Unknown",
      title: doc.title || "NIL",
      firstInteraction: doc.first_interact?.text || "No start time",
      lastInteraction: doc.last_interact?.text || "No last interaction",
      messages: doc.messages || [],
    }));

    if (conversations.length === 0) {
      return NextResponse.json({ message: "No conversations found" }, { status: 404 });
    }

    return NextResponse.json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}