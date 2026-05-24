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
  const { imageBase64, mediaType, pixelsPerFoot, imageWidth, imageHeight } = (await req.json()) as {
    imageBase64: string;
    mediaType: string;
    pixelsPerFoot: number;
    imageWidth: number;
    imageHeight: number;
  };

  if (!imageBase64 || !pixelsPerFoot) {
    return NextResponse.json({ error: "imageBase64 and pixelsPerFoot are required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not set — vision auto-detect requires an API key." },
      { status: 400 },
    );
  }

  const client = new Anthropic({ apiKey });

  const prompt = `You are looking at a residential floor plan image. The image is ${imageWidth}px × ${imageHeight}px and the calibrated scale is ${pixelsPerFoot.toFixed(2)} pixels per foot.

Identify each distinct room (Living/Dining, Bedroom, Bathroom, Kitchen, Terrace, Entry/Foyer, Closet, Laundry, etc.). For each room, return an axis-aligned bounding rectangle in image pixel coordinates that covers the interior floor area (NOT including walls).

Also identify each door — return its hinge point in image pixels, approximate opening width in feet, and which way it swings.

Respond with ONLY valid JSON (no markdown fences, no prose). Schema:
{
  "rooms": [
    { "name": "Bedroom", "x": <px>, "y": <px>, "width": <px>, "height": <px> }
  ],
  "doors": [
    { "label": "Bedroom door", "x": <px>, "y": <px>, "widthFt": <number>, "angleDeg": <0-360>, "swing": "left" | "right" }
  ]
}

Where (x,y) is the top-left corner of the bounding box, measured from the top-left of the image. For doors, angleDeg=0 means the wall runs horizontally to the right.`;

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
      rooms: { name: string; x: number; y: number; width: number; height: number }[];
      doors: { label: string; x: number; y: number; widthFt: number; angleDeg: number; swing: "left" | "right" }[];
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
