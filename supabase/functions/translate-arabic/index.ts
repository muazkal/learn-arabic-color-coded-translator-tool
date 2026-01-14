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

    const systemPrompt = `You are an expert Arabic linguist specializing in Arabic-to-English translation.

Your task is to translate Arabic text and provide word-by-word alignment for color-coding purposes.

CRITICAL REQUIREMENTS:

1. ARABIC DISPLAY FORMAT:
   - Keep Arabic words in their NATURAL JOINED form
   - DO NOT separate prefixes like لِ، بِ، وَ، فِي، الـ from their words
   - Display: "لِطَلَبِ" NOT "لِ + طَلَب"
   - Display: "الْعِلْمِ" NOT "ال + علم"
   - Display: "وَقَالَ" NOT "وَ + قَالَ"
   - Each Arabic word should appear exactly as it would in normal Arabic text

2. ENGLISH TRANSLATION:
   - The "englishLine" must be a GRAMMATICALLY CORRECT English sentence
   - Reorder words to natural English syntax
   - DO NOT use literal Arabic word order
   - Example: "وَقَالَ فِي نَفْسِهِ" → "and he said to himself" (natural English)

3. WORD PAIRS FOR COLOR ALIGNMENT:
   - Each pair maps ONE Arabic word (in display form) to its English meaning
   - The English in pairs can be a phrase that captures the word's full meaning
   - Include attached pronouns in the meaning (e.g., "نَفْسِهِ" → "himself" or "to himself")

4. PRESERVE:
   - All punctuation (attach to nearest word)
   - Line breaks from original text

Return ONLY valid JSON in this exact format:
{
  "lines": [
    {
      "arabicLine": "أُرِيدُ أَنْ أُسَافِرَ لِطَلَبِ الْعِلْمِ",
      "englishLine": "I want to travel to seek knowledge",
      "pairs": [
        {"arabic": "أُرِيدُ", "english": "I want"},
        {"arabic": "أَنْ", "english": "to"},
        {"arabic": "أُسَافِرَ", "english": "travel"},
        {"arabic": "لِطَلَبِ", "english": "to seek"},
        {"arabic": "الْعِلْمِ", "english": "knowledge"}
      ]
    }
  ]
}

REMEMBER:
- englishLine = natural, grammatical English sentence
- pairs = word-by-word alignment for color-coding (Arabic in joined form)
- Arabic words stay joined (prefixes attached)
- English is reordered to sound natural`;

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
