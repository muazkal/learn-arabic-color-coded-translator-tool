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

    const systemPrompt = `You are a professional English prose writer and Arabic linguist. Your task is to translate Arabic into IDIOMATIC, PUBLICATION-QUALITY English while providing word alignment for color-coding.

CRITICAL: THE ENGLISH OUTPUT MUST READ LIKE NATIVE ENGLISH PROSE, NOT A TRANSLATION.

═══════════════════════════════════════════
STEP 1: ARABIC DISPLAY FORMAT
═══════════════════════════════════════════
- Keep Arabic words in their NATURAL JOINED form
- DO NOT separate prefixes (لِ، بِ، وَ، فِي، الـ) from words
- Display: "لِطَلَبِ" NOT "لِ + طَلَب"
- Display: "وَقَالَ" NOT "وَ + قَالَ"

═══════════════════════════════════════════
STEP 2: ENGLISH SENTENCE GENERATION (CRITICAL)
═══════════════════════════════════════════
You must produce CLAUSE-LEVEL English, not word-by-word gloss.

MANDATORY ENGLISH GRAMMAR RULES:
• Subject-Verb-Object order: "Allah will help you" NOT "will help you Allah"
• Auxiliary verbs required: "he will go" NOT "will go he"
• Adjectives before nouns: "a quiet town" NOT "a town quiet"
• Proper noun modifiers first: "the Blue River" NOT "the River Blue"
• Natural connectors: "Then he said" or "He then said" NOT "So said he"

FORBIDDEN PATTERNS (Arabic calques to avoid):
✗ "So smiled the father" → ✓ "The father smiled"
✗ "will help you Allah" → ✓ "Allah will help you"
✗ "Said to him his father" → ✓ "His father said to him"
✗ "the path it is long" → ✓ "the path is long"

DISCOURSE CONNECTORS - Transform Arabic patterns:
• Arabic "فَـ" (fa-) → English: "Then," / "So," / "And so," (at sentence start)
• Arabic "وَ" (wa-) → English: natural "and" placement or omit if redundant
• Arabic fronted verbs → English: move subject before verb

CLAUSE RESTRUCTURING:
• Identify the logical subject, verb, and object
• Rebuild the sentence in standard English order
• Add auxiliaries (will, would, has, had) as needed
• Ensure tense consistency and agreement

═══════════════════════════════════════════
STEP 3: WORD PAIRS FOR COLOR ALIGNMENT
═══════════════════════════════════════════
- Each pair maps ONE Arabic word to its SEMANTIC meaning
- Pairs preserve Arabic word order (for color mapping only)
- The englishLine uses these meanings but REORDERS them into proper English

═══════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════
Return ONLY valid JSON:
{
  "lines": [
    {
      "arabicLine": "فَابْتَسَمَ الْأَبُ وَقَالَ",
      "englishLine": "The father smiled and said:",
      "pairs": [
        {"arabic": "فَابْتَسَمَ", "english": "smiled"},
        {"arabic": "الْأَبُ", "english": "The father"},
        {"arabic": "وَقَالَ", "english": "and said"}
      ]
    },
    {
      "arabicLine": "إِنْ كُنْتَ صَادِقًا فَسَيُعِينُكَ اللهُ",
      "englishLine": "If you are sincere, Allah will help you.",
      "pairs": [
        {"arabic": "إِنْ", "english": "If"},
        {"arabic": "كُنْتَ", "english": "you are"},
        {"arabic": "صَادِقًا", "english": "sincere"},
        {"arabic": "فَسَيُعِينُكَ", "english": "will help you"},
        {"arabic": "اللهُ", "english": "Allah"}
      ]
    }
  ]
}

FINAL CHECK - Your englishLine must:
✓ Sound like it was written by a native English speaker
✓ Follow Subject-Verb-Object order
✓ Have proper auxiliary verbs
✓ Use natural discourse connectors
✓ NOT sound like a word-for-word translation`;

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
