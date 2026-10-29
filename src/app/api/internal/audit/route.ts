import {NextResponse} from 'next/server';
// Audit writes are server-internal; never transmit the session signing secret.
export async function POST(){return NextResponse.json({error:'Not found'},{status:404});}
