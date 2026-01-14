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

    const systemPrompt = `You are an expert Arabic linguist specializing in morphological analysis and Arabic-to-English translation.

Your task is to perform MORPHOLOGICAL SEGMENTATION of Arabic text and provide word-by-word translations.

For each Arabic word, you must break it down into its meaningful morphological units:
- Prefixes (أ، ت، ي، ن، ال، و، ف، ب، ل، ك، س)
- Root/stem
- Suffixes and attached pronouns (ـي، ـك، ـه، ـها، ـكم، ـهم، ـنا، ـون، ـين، ـات، ة)
- Verb conjugation markers
- Particles

Each morphological unit should have its own English meaning.

IMPORTANT RULES:
1. Keep the Arabic text in reading order (right-to-left within each unit)
2. Preserve ALL punctuation - attach it to the nearest word
3. Mark line breaks with a special marker: {"arabic": "[LINE_BREAK]", "english": "[LINE_BREAK]"}
4. Each unit should be the SMALLEST meaningful morpheme when possible
5. For common phrases that form a single semantic unit, keep them together

Return ONLY valid JSON in this exact format:
{
  "lines": [
    {
      "arabicLine": "الجملة العربية الكاملة",
      "englishLine": "The complete English sentence",
      "pairs": [
        {"arabic": "أُرِيدُ", "english": "I want"},
        {"arabic": "أَنْ", "english": "to"},
        {"arabic": "أَتَعَلَّمَ", "english": "learn"}
      ]
    }
  ]
}

Example morphological breakdown:
- "يتعلمون" → "they are learning" (keep as one if semantic unit)
- "كتابي" → split into "كتاب" (book) + "ي" (my) OR keep as "كتابي" (my book)
- "والله" → "و" (and) + "الله" (Allah/God)
- "بسم" → "ب" (in/by) + "اسم" (name)

For Quranic or classical Arabic, provide accurate translations preserving the meaning.`;

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
