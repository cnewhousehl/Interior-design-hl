import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { CATALOG } from "@/lib/catalog";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Take a photo of a room and ask Claude to identify the furniture in it.
 * Returns a list of pieces matched against the local catalog (by id), with
 * estimated dimensions and a position hint ("left of frame", "back wall").
 *
 * Position hints are intentionally fuzzy — a photo doesn't give us a top-down
 * scale, so we don't try to derive precise (x, y) coordinates. The user uses
 * this as a starting point to drop pieces, then arranges them with the normal
 * placement tools.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    imageBase64: string;
    mediaType: string;
    apiKey?: string;
  };
  const { imageBase64, mediaType } = body;

  if (!imageBase64) {
    return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });
  }

  const apiKey = body.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not set — photo identification requires an API key." },
      { status: 400 },
    );
  }

  const client = new Anthropic({ apiKey });

  const catalogSummary = CATALOG.map(
    (c) => `${c.id} (${c.name}, ${c.category}, ${c.width}'×${c.depth}')`,
  ).join("; ");

  const prompt = `You are looking at a photo of a room. Identify the major furniture pieces visible.

For each piece, return:
- a catalog id from this list if a reasonable match exists, otherwise null:
${catalogSummary}
- a label (what to call it, e.g. "Brown leather sofa")
- estimated dimensions in feet (widthFt, depthFt)
- a positionHint describing where in the photo it sits (e.g. "front-left", "against back wall", "center")
- a confidence (0-1)

Respond ONLY with valid JSON, no markdown. Schema:
{ "items": [ { "catalogId": "...", "label": "...", "widthFt": <number>, "depthFt": <number>, "positionHint": "...", "confidence": <number> } ] }`;

  try {
    const resp = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: (mediaType ?? "image/jpeg") as
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
      items: { catalogId: string | null; label: string; widthFt: number; depthFt: number; positionHint: string; confidence: number }[];
    };
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[identify-furniture]", err);
    return NextResponse.json({ error: "Identification failed", detail: String(err) }, { status: 500 });
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
