import { NextResponse } from 'next/server';
import { getUserCollection } from "@/lib/cosmosdb";

export async function POST(req: Request) {
    try{
        const body = await req.json();
        const { username } = body;

        if(!username){
            return new Response('Username is required', { status: 400 });
        }
        const userCollection = await getUserCollection()
        console.log("userCollection: ", userCollection)
        const user = await userCollection.findOne({username});
        console.log("user: ", user)

        if(!user){
            return new Response('User not found', { status: 404 });
        }
        return new Response(JSON.stringify(user), { status: 200 });
    } catch (error) {
        console.error("Login route error:", error);
        return new Response('Internal Server Error', { status: 500 });
    }
}