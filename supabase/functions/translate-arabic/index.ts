import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { arabicText } = await req.json();
    
    if (!arabicText || typeof arabicText !== 'string') {
      return new Response(
        JSON.stringify({ error: "Arabic text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `YOU ARE A NATIVE ENGLISH AUTHOR, NOT A TRANSLATOR.

Your task: Read Arabic text, understand its meaning, then WRITE original English prose.

═══════════════════════════════════════════
CRITICAL ROLE DEFINITION
═══════════════════════════════════════════
You are NOT translating. You are WRITING.

Process:
1. Read the Arabic and understand the MEANING
2. FORGET the Arabic word order completely
3. WRITE an English sentence as a published author would
4. The Arabic is only background context — your output is ORIGINAL ENGLISH

═══════════════════════════════════════════
ARABIC DISPLAY (unchanged)
═══════════════════════════════════════════
- Keep Arabic words in their NATURAL JOINED form
- DO NOT separate prefixes from words
- Display: "فَابْتَسَمَ" NOT "فَـ + ابْتَسَمَ"

═══════════════════════════════════════════
ENGLISH COMPOSITION (MANDATORY)
═══════════════════════════════════════════
Write English as if you are the original author. Examples:

Arabic meaning: "So-smiled the-father and-said"
YOU WRITE: "His father smiled and said,"

Arabic meaning: "If you-are sincere, will-help-you Allah"
YOU WRITE: "If you are sincere, Allah will help you."

Arabic meaning: "in town quiet called River Blue"
YOU WRITE: "in a quiet town called the Blue River"

Arabic meaning: "lived young-man his-name Yusuf"
YOU WRITE: "there lived a young man named Yusuf"

ABSOLUTE RULES:
• Subject BEFORE verb: "The father smiled" NOT "Smiled the father"
• Adjective BEFORE noun: "quiet town" NOT "town quiet"
• Modifier BEFORE proper noun: "Blue River" NOT "River Blue"
• Auxiliary verbs required: "will help" NOT "help"
• Natural flow: "His father smiled and said" NOT "So smiled the father and said"

FORBIDDEN — These indicate FAILURE:
✗ "So smiled the father" (verb before subject)
✗ "will help you Allah" (object before subject)
✗ "town quiet" (noun before adjective)
✗ "River Blue" (noun before modifier)
✗ Any sentence that sounds translated

═══════════════════════════════════════════
WORD PAIRS (for color mapping AFTER writing)
═══════════════════════════════════════════
After you write the English sentence:
- Create pairs mapping Arabic words to their semantic meaning
- Pairs follow Arabic order (for color alignment only)
- The englishLine is your COMPOSED sentence (not built from pairs)

═══════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════
Return ONLY valid JSON:
{
  "lines": [
    {
      "arabicLine": "فَابْتَسَمَ الْأَبُ وَقَالَ",
      "englishLine": "His father smiled and said:",
      "pairs": [
        {"arabic": "فَابْتَسَمَ", "english": "smiled"},
        {"arabic": "الْأَبُ", "english": "father"},
        {"arabic": "وَقَالَ", "english": "and said"}
      ]
    },
    {
      "arabicLine": "إِنْ صَدَقْتَ أَعَانَكَ اللَّهُ",
      "englishLine": "If you are sincere, Allah will help you.",
      "pairs": [
        {"arabic": "إِنْ", "english": "If"},
        {"arabic": "صَدَقْتَ", "english": "you are sincere"},
        {"arabic": "أَعَانَكَ", "english": "will help you"},
        {"arabic": "اللَّهُ", "english": "Allah"}
      ]
    }
  ]
}

═══════════════════════════════════════════
SELF-CHECK BEFORE RESPONDING
═══════════════════════════════════════════
Read your englishLine aloud. Ask:
✓ Does this sound like a sentence from a published English novel?
✓ Would a native speaker write it this way?
✓ Is there ANY trace of Arabic word order?

If the answer to the last question is YES, REWRITE IT.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Perform morphological segmentation and translation for this Arabic text:\n\n${arabicText}` }
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage limit reached. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Translation service unavailable");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No translation received");
    }

    // Parse the JSON response
    let translationResult;
    try {
      // Extract JSON from the response (handle markdown code blocks)
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1].trim();
      translationResult = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse translation JSON:", content);
      
      // Fallback: Create basic structure from the input
      const lines = arabicText.split(/\n+/).filter((l: string) => l.trim());
      translationResult = {
        lines: lines.map((line: string) => {
          const words = line.trim().split(/\s+/);
          return {
            arabicLine: line.trim(),
            englishLine: "Translation unavailable - please edit manually",
            pairs: words.map((word: string) => ({
              arabic: word,
              english: ""
            }))
          };
        })
      };
    }

    return new Response(
      JSON.stringify(translationResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Translation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Translation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
