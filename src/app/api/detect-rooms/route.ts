import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Given a base64-encoded floor plan image and its calibrated scale (pixels per foot),
 * ask Claude to identify rooms — name + bounding rectangle in image pixels.
 * We deliberately keep this simple (axis-aligned bounding boxes per room) rather than
 * tracing complex wall polygons — vision models are still shaky on precise geometry.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    imageBase64: string;
    mediaType: string;
    pixelsPerFoot: number;
    imageWidth: number;
    imageHeight: number;
    apiKey?: string;
  };
  const { imageBase64, mediaType, pixelsPerFoot, imageWidth, imageHeight } = body;

  if (!imageBase64 || !pixelsPerFoot) {
    return NextResponse.json({ error: "imageBase64 and pixelsPerFoot are required" }, { status: 400 });
  }

  const apiKey = body.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not set — vision auto-detect requires an API key." },
      { status: 400 },
    );
  }

  const client = new Anthropic({ apiKey });

  const prompt = `You are looking at a residential floor plan image. The image is ${imageWidth}px × ${imageHeight}px and the calibrated scale is ${pixelsPerFoot.toFixed(2)} pixels per foot.

Identify:
1. Each distinct room (Living/Dining, Bedroom, Bathroom, Kitchen, Terrace, Entry/Foyer, Closet, Laundry, etc.). For each, return an axis-aligned bounding rectangle in image pixel coordinates covering the interior floor area (NOT including walls).
2. Each major wall segment — return endpoints (x1,y1)-(x2,y2). Include exterior perimeter walls AND interior partition walls. Use straight axis-aligned segments only; for L-shaped walls, return them as multiple segments.
3. Each door — hinge point, opening width in feet, swing direction.
4. Each fixture/appliance visible — kitchen sink, range/stove, refrigerator, dishwasher, washer/dryer, toilet, shower, bathtub. Position is the center of the fixture. Use the listed kind strings exactly.

Respond with ONLY valid JSON (no markdown fences, no prose). Schema:
{
  "rooms": [
    { "name": "Bedroom", "x": <px>, "y": <px>, "width": <px>, "height": <px> }
  ],
  "walls": [
    { "x1": <px>, "y1": <px>, "x2": <px>, "y2": <px> }
  ],
  "doors": [
    { "label": "Bedroom door", "x": <px>, "y": <px>, "widthFt": <number>, "angleDeg": <0-360>, "swing": "left" | "right" }
  ],
  "fixtures": [
    { "kind": "sink" | "range" | "fridge" | "dishwasher" | "washer-dryer" | "toilet" | "shower" | "tub", "x": <px>, "y": <px>, "label": "Kitchen sink" }
  ]
}

Where (x,y) is the top-left corner of the bounding box (rooms) or the center point (doors, fixtures), measured from the top-left of the image. For doors, angleDeg=0 means the wall runs horizontally to the right.

Be conservative — only include things you're highly confident about. Skip ambiguous items rather than guessing.`;

  try {
    const resp = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: (mediaType ?? "image/png") as
                  | "image/png"
                  | "image/jpeg"
                  | "image/gif"
                  | "image/webp",
                data: imageBase64,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const json = extractJson(text);
    const parsed = JSON.parse(json) as {
      rooms?: { name: string; x: number; y: number; width: number; height: number }[];
      walls?: { x1: number; y1: number; x2: number; y2: number }[];
      doors?: { label: string; x: number; y: number; widthFt: number; angleDeg: number; swing: "left" | "right" }[];
      fixtures?: { kind: string; x: number; y: number; label?: string }[];
    };
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[detect-rooms]", err);
    return NextResponse.json({ error: "Detection failed", detail: String(err) }, { status: 500 });
  }
}

function extractJson(text: string): string {
  const fence = text.match(/```json\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text.trim();
}
