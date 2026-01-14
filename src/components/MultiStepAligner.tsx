import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Download, FileText, Code, Sparkles, Languages, Loader2, CheckCircle, Edit3, ArrowRight, ArrowLeft, RotateCcw, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const COLORS = [
  { name: 'red', hex: '#dc2626' },
  { name: 'blue', hex: '#2563eb' },
  { name: 'green', hex: '#16a34a' },
  { name: 'orange', hex: '#ea580c' },
  { name: 'purple', hex: '#9333ea' },
];

interface TranslationPair {
  arabic: string;
  english: string;
}

interface TranslationLine {
  arabicLine: string;
  englishLine: string;
  pairs: TranslationPair[];
}

interface ColoredPair {
  arabic: string;
  english: string;
  color: string;
  colorName: string;
}

interface ColoredLine {
  arabicLine: string;
  englishLine: string;
  pairs: ColoredPair[];
}

type Step = 'input' | 'editing' | 'output';

// Arabic character validation regex - allows Arabic letters, diacritics, punctuation, spaces, newlines
const ARABIC_REGEX = /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u200C\u200D\s\n\r.,،؛:؟!٪٫٬«»\-_()\[\]۰-۹٠-٩]+$/;

function isValidArabicOnly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return ARABIC_REGEX.test(trimmed);
}

export function MultiStepAligner() {
  const [step, setStep] = useState<Step>('input');
  const [arabicText, setArabicText] = useState('');
  const [lines, setLines] = useState<TranslationLine[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [finalLines, setFinalLines] = useState<ColoredLine[]>([]);
  const { toast } = useToast();

  const handleArabicChange = (value: string) => {
    setArabicText(value);
    if (value.trim() && !isValidArabicOnly(value)) {
      setValidationError('Only Arabic characters are allowed. Please remove any English letters, numbers, or non-Arabic symbols.');
    } else {
      setValidationError(null);
    }
  };

  const handleSubmitArabic = async () => {
    if (!arabicText.trim()) {
      toast({
        title: "No text entered",
        description: "Please enter Arabic text to translate.",
        variant: "destructive",
      });
      return;
    }

    if (!isValidArabicOnly(arabicText)) {
      toast({
        title: "Invalid input",
        description: "Only Arabic characters are allowed. Please remove any non-Arabic text.",
        variant: "destructive",
      });
      return;
    }

    setIsTranslating(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('translate-arabic', {
        body: { arabicText }
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Set lines from AI response
      if (data.lines && data.lines.length > 0) {
        setLines(data.lines);
      } else {
        // Fallback: create basic structure
        const textLines = arabicText.split(/\n+/).filter(l => l.trim());
        const fallbackLines: TranslationLine[] = textLines.map(line => {
          const words = line.trim().split(/\s+/);
          return {
            arabicLine: line.trim(),
            englishLine: '',
            pairs: words.map(word => ({ arabic: word, english: '' }))
          };
        });
        setLines(fallbackLines);
      }

      setStep('editing');
      toast({
        title: "Morphological analysis complete",
        description: "Review and edit the translations below.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Translation failed';
      setError(message);
      toast({
        title: "Translation failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const handlePairChange = (lineIdx: number, pairIdx: number, english: string) => {
    setLines(prev => {
      const updated = [...prev];
      updated[lineIdx] = {
        ...updated[lineIdx],
        pairs: updated[lineIdx].pairs.map((p, i) => 
          i === pairIdx ? { ...p, english } : p
        )
      };
      // Update the englishLine to reflect changes
      updated[lineIdx].englishLine = updated[lineIdx].pairs.map(p => p.english).join(' ');
      return updated;
    });
  };

  const handleSubmitTranslation = () => {
    let colorIdx = 0;
    const coloredLines: ColoredLine[] = lines.map(line => {
      const coloredPairs: ColoredPair[] = line.pairs.map(pair => {
        const color = COLORS[colorIdx % COLORS.length];
        colorIdx++;
        return {
          arabic: pair.arabic,
          english: pair.english,
          color: color.hex,
          colorName: color.name,
        };
      });

      return {
        arabicLine: line.arabicLine,
        englishLine: coloredPairs.map(p => p.english).join(' '),
        pairs: coloredPairs,
      };
    });

    setFinalLines(coloredLines);
    setStep('output');
    toast({
      title: "Color-coding complete",
      description: "Your text is ready to download.",
    });
  };

  const generateFinalHTML = (): string => {
    const linesHTML = finalLines.map(line => {
      const arabicSpans = line.pairs.map(p => 
        `<span style="color:${p.color};font-weight:600;">${p.arabic}</span>`
      ).join(' ');
      
      const englishSpans = line.pairs.map(p => 
        `<span style="color:${p.color};font-weight:500;">${p.english}</span>`
      ).join(' ');

      return `
      <div class="line-pair">
        <div class="arabic-line" dir="rtl">${arabicSpans}</div>
        <div class="english-line">${englishSpans}</div>
      </div>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Arabic-English Color-Coded Translation</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
      background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%);
      min-height: 100vh;
    }
    h1 {
      text-align: center;
      color: #1f2937;
      margin-bottom: 2rem;
      font-size: 1.5rem;
    }
    .line-pair {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    .arabic-line {
      font-size: 1.75rem;
      line-height: 2.5;
      text-align: right;
      margin-bottom: 0.75rem;
      font-family: 'Traditional Arabic', 'Scheherazade', 'Amiri', serif;
      letter-spacing: 0.02em;
      word-spacing: 0.3em;
    }
    .english-line {
      font-size: 1.1rem;
      line-height: 2;
      color: #374151;
      padding-top: 0.5rem;
      border-top: 1px solid #e5e7eb;
      word-spacing: 0.2em;
    }
    .arabic-line span, .english-line span {
      display: inline;
      padding: 0.15em 0.3em;
      border-radius: 4px;
      background: rgba(0,0,0,0.03);
      margin: 0 0.1em;
    }
    @media print {
      body {
        background: white;
        padding: 1rem;
      }
      .line-pair {
        box-shadow: none;
        border: 1px solid #e5e7eb;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <h1>Arabic-English Word-by-Word Translation</h1>
  ${linesHTML}
</body>
</html>`;
  };

  const generateCSV = (): string => {
    const header = 'Arabic,English,Color';
    const rows: string[] = [];
    finalLines.forEach(line => {
      line.pairs.forEach(pair => {
        const arabic = `"${pair.arabic.replace(/"/g, '""')}"`;
        const english = `"${pair.english.replace(/"/g, '""')}"`;
        rows.push(`${arabic},${english},${pair.colorName}`);
      });
    });
    return [header, ...rows].join('\n');
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    const csv = generateCSV();
    downloadFile(csv, 'arabic-english-translation.csv', 'text/csv;charset=utf-8;');
    toast({ title: "CSV downloaded" });
  };

  const handleDownloadHTML = () => {
    const html = generateFinalHTML();
    downloadFile(html, 'arabic-english-translation.html', 'text/html;charset=utf-8;');
    toast({ title: "HTML downloaded" });
  };

  const handleReset = () => {
    setStep('input');
    setArabicText('');
    setLines([]);
    setFinalLines([]);
    setError(null);
    setValidationError(null);
  };

  const colorClasses: Record<string, { text: string; bg: string }> = {
    red: { text: 'text-red-600', bg: 'bg-red-50' },
    blue: { text: 'text-blue-600', bg: 'bg-blue-50' },
    green: { text: 'text-green-600', bg: 'bg-green-50' },
    orange: { text: 'text-orange-500', bg: 'bg-orange-50' },
    purple: { text: 'text-purple-600', bg: 'bg-purple-50' },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="w-8 h-8 text-amber-600" />
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
              Arabic Morphological Color Coder
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            AI-powered morphological analysis with word-by-word color-coded translations
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex justify-center items-center gap-4 mb-8">
          {[
            { key: 'input', label: 'Input Arabic', icon: Languages },
            { key: 'editing', label: 'Edit Translations', icon: Edit3 },
            { key: 'output', label: 'Final Output', icon: Download },
          ].map((s, idx) => (
            <div key={s.key} className="flex items-center gap-2">
              <div className={`
                flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                ${step === s.key 
                  ? 'bg-amber-600 text-white border-amber-600' 
                  : finalLines.length > 0 && idx < ['input', 'editing', 'output'].indexOf(step)
                    ? 'bg-green-100 text-green-700 border-green-500'
                    : 'bg-muted text-muted-foreground border-border'}
              `}>
                <s.icon className="w-5 h-5" />
              </div>
              <span className={`text-sm font-medium hidden sm:inline ${step === s.key ? 'text-foreground' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
              {idx < 2 && <ArrowRight className="w-4 h-4 text-muted-foreground ml-4" />}
            </div>
          ))}
        </div>

        {/* Step 1: Arabic Input */}
        {step === 'input' && (
          <Card className="animate-fade-in shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Languages className="w-5 h-5" />
                Step 1: Enter Arabic Text Only
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <strong>Note:</strong> Only Arabic characters are accepted. English letters, numbers, or other scripts will be rejected.
              </div>
              
              <Textarea
                placeholder="اكتب النص العربي هنا...&#10;&#10;مثال: أريد أن أتعلم اللغة العربية"
                value={arabicText}
                onChange={(e) => handleArabicChange(e.target.value)}
                className="min-h-[250px] text-xl font-arabic text-right resize-none border-2 focus:border-amber-500"
                dir="rtl"
              />
              
              {validationError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                size="lg"
                onClick={handleSubmitArabic}
                disabled={isTranslating || !arabicText.trim() || !!validationError}
                className="w-full gap-2 bg-amber-600 hover:bg-amber-700"
              >
                {isTranslating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Performing Morphological Analysis...
                  </>
                ) : (
                  <>
                    Submit Arabic Text
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Editable Translation Table (Review Only) */}
        {step === 'editing' && (
          <Card className="animate-fade-in shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit3 className="w-5 h-5" />
                Step 2: Review & Edit Translations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <strong>Review Mode:</strong> Edit the English translations below. This table is for editing only — the final output will show full sentences with color-coded words.
              </div>

              <div className="space-y-6">
                {lines.map((line, lineIdx) => (
                  <div key={lineIdx} className="border rounded-lg overflow-hidden">
                    <div className="bg-muted p-3">
                      <div className="font-arabic text-lg text-right" dir="rtl">
                        {line.arabicLine}
                      </div>
                    </div>
                    <div className="divide-y">
                      {line.pairs.map((pair, pairIdx) => (
                        <div 
                          key={pairIdx} 
                          className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-muted/50 transition-colors"
                        >
                          <div className="col-span-1 text-center text-sm text-muted-foreground">
                            {pairIdx + 1}
                          </div>
                          <div 
                            className="col-span-5 text-right pr-4 font-arabic text-lg bg-amber-50 rounded px-2 py-1"
                            dir="rtl"
                          >
                            {pair.arabic}
                          </div>
                          <div className="col-span-6">
                            <Input
                              value={pair.english}
                              onChange={(e) => handlePairChange(lineIdx, pairIdx, e.target.value)}
                              placeholder="Enter translation..."
                              className="text-base"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setStep('input')}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button
                  size="lg"
                  onClick={handleSubmitTranslation}
                  className="flex-1 gap-2 bg-amber-600 hover:bg-amber-700"
                >
                  <CheckCircle className="w-5 h-5" />
                  Confirm Translation
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Final Color-Coded Output (Sentence-based, NOT table) */}
        {step === 'output' && (
          <div className="space-y-6 animate-fade-in">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Final Color-Coded Output
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 space-y-6">
                  {finalLines.map((line, lineIdx) => (
                    <div 
                      key={lineIdx} 
                      className="bg-white rounded-xl p-5 shadow-md space-y-3"
                    >
                      {/* Arabic Line - Full sentence with colored words */}
                      <div 
                        className="text-2xl font-arabic leading-loose text-right"
                        dir="rtl"
                      >
                        {line.pairs.map((pair, pairIdx) => {
                          const colors = colorClasses[pair.colorName] || colorClasses.red;
                          return (
                            <span 
                              key={pairIdx}
                              className={`${colors.text} font-semibold inline-block mx-1 px-2 py-0.5 rounded ${colors.bg}`}
                              style={{ color: pair.color }}
                            >
                              {pair.arabic}
                            </span>
                          );
                        })}
                      </div>
                      
                      {/* Divider */}
                      <div className="border-t border-gray-200"></div>
                      
                      {/* English Line - Full sentence with colored words */}
                      <div className="text-lg leading-relaxed">
                        {line.pairs.map((pair, pairIdx) => {
                          const colors = colorClasses[pair.colorName] || colorClasses.red;
                          return (
                            <span 
                              key={pairIdx}
                              className={`${colors.text} font-medium inline-block mx-1 px-2 py-0.5 rounded ${colors.bg}`}
                              style={{ color: pair.color }}
                            >
                              {pair.english}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Color Legend */}
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  {COLORS.map((color, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center gap-2 px-3 py-1 rounded-full border"
                      style={{ borderColor: color.hex }}
                    >
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: color.hex }}
                      ></div>
                      <span className="text-sm capitalize">{color.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" onClick={handleDownloadHTML} className="gap-2 bg-amber-600 hover:bg-amber-700">
                <Code className="w-5 h-5" />
                Download HTML
                <Download className="w-4 h-4" />
              </Button>
              <Button size="lg" variant="secondary" onClick={handleDownloadCSV} className="gap-2">
                <FileText className="w-5 h-5" />
                Download CSV
                <Download className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex justify-center gap-3 pt-4">
              <Button variant="outline" onClick={() => setStep('editing')} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Edit Translations
              </Button>
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Start Over
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
