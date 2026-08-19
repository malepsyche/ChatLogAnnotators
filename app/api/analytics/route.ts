import { NextResponse } from "next/server";
import { getCollection } from "@/lib/cosmosdb";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const collection = await getCollection();
    const documents = await collection.find({}).toArray();
    const userAccessGroup = (await cookies()).get("userAccessGroup")?.value;
    const filteredDocuments = documents.filter((doc) =>
      doc.accessGroups?.includes(userAccessGroup)
    );
    const completedCount = filteredDocuments.filter(
      (doc) => doc.annotationComplete === true
    ).length;
    const annotationPercentage =
      filteredDocuments.length === 0
        ? 0
        : (completedCount / filteredDocuments.length) * 100;

    return NextResponse.json({
      annotationPercentage,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}