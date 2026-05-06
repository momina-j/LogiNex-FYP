import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // The Flask server URL - default to localhost:5000 if not in env
    // "No port numbers" in instructions usually means avoid hardcoding them directly in UI,
    // but the API must know where the backend is.
    const FLASK_URL = process.env.FLASK_BACKEND_URL || 'http://127.0.0.1:5000';

    const response = await fetch(`${FLASK_URL}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Flask server responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Prediction API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to call prediction service' },
      { status: 500 }
    );
  }
}
