import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { CATALOG } from "@/lib/catalog";
import { ALL_THEMES, type Theme } from "@/lib/types";

export const runtime = "nodejs";

type Recommendation = {
  catalogId?: string; // if it matches an existing catalog item
  name: string;
  category: string;
  widthFt?: number;
  depthFt?: number;
  why: string; // 1 sentence why it suits the theme/space
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    theme: Theme;
    placed: { catalogId: string; label: string }[];
    roomNotes?: string;
    apiKey?: string;
  };
  const { theme, placed, roomNotes } = body;

  if (!theme) {
    return NextResponse.json({ error: "theme is required" }, { status: 400 });
  }

  const apiKey = body.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fall back to local catalog matches so the app remains useful without a key.
    const fallback = CATALOG.filter((c) => c.themes.includes(theme))
      .slice(0, 8)
      .map<Recommendation>((c) => ({
        catalogId: c.id,
        name: c.name,
        category: c.category,
        widthFt: c.width,
        depthFt: c.depth,
        why: c.description ?? `Fits ${themeLabel(theme)} via shape and proportions.`,
      }));
    return NextResponse.json({ source: "catalog", recommendations: fallback });
  }

  const client = new Anthropic({ apiKey });

  const themeMeta = ALL_THEMES.find((t) => t.id === theme);
  const placedSummary = placed
    .map((p) => `- ${p.label} (catalogId=${p.catalogId})`)
    .join("\n") || "(nothing placed yet)";
  const catalogSummary = CATALOG.map(
    (c) => `- ${c.id} | ${c.name} | ${c.category} | ${c.width}'×${c.depth}' | themes:[${c.themes.join(",")}]`,
  ).join("\n");

  const system = `You are an interior designer assistant helping plan furniture for a small NYC apartment. You suggest specific pieces from a catalog when possible, with real-world dimensions in feet. Be concise. Output ONLY valid JSON, no prose, no markdown fences.`;

  const user = `Theme: ${themeMeta?.label ?? theme} — ${themeMeta?.description ?? ""}

Apartment notes:
${roomNotes ?? "(none)"}

Currently placed:
${placedSummary}

Catalog (id | name | category | dims | themes):
${catalogSummary}

Recommend 6-10 pieces. Prefer existing catalog items by setting catalogId. If you suggest something not in the catalog, set catalogId to null and include widthFt/depthFt. Each item: { catalogId, name, category, widthFt, depthFt, why }. Respond as JSON: { "recommendations": [...] }`;

  try {
    const resp = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const json = extractJson(text);
    const parsed = JSON.parse(json) as { recommendations: Recommendation[] };
    return NextResponse.json({ source: "claude", ...parsed });
  } catch (err) {
    console.error("[recommendations]", err);
    return NextResponse.json(
      { error: "Recommendation generation failed", detail: String(err) },
      { status: 500 },
    );
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

function themeLabel(t: Theme): string {
  return ALL_THEMES.find((x) => x.id === t)?.label ?? t;
}
