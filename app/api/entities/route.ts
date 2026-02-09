import { NextResponse } from 'next/server';

export async function GET() {
  const entities = ['All', 'HQ', 'USA', 'BWA', 'Vietnam', 'Healthcare', 'Korot', 'Japan', 'China'];
  
  return NextResponse.json({ entities });
}
