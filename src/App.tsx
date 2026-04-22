import { useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";

type Scenario = {
  nextStep: string;
  why: string;
  questions: string[];
  avoid: string[];
};

type CopyState = "idle" | "advice" | "questions";

const EXAMPLES = [
  "Mijn medewerker lijkt steeds vermoeider, stiller of sneller geïrriteerd. Ik ben bang dat het teveel wordt.",
  "Er ontstaat steeds meer spanning of conflict rond deze medewerker.",
  "Mijn medewerker meldt zich vaak ziek en ik weet niet goed hoe ik dit bespreek.",
];

const SCENARIOS: Record<string, Scenario> = {
  overload: {
    nextStep:
      "Plan binnen een week een rustig gesprek van ongeveer 30 minuten, onder vier ogen. Bied daarnaast de mogelijkheid van een preventief spreekuur bij de bedrijfsarts aan.",
    why:
      "Het lijkt erop dat de belasting langzaam oploopt. Juist door dit nu rustig te bespreken, voorkom je dat het erger wordt.",
    questions: [
      "Ik merk dat je de laatste tijd sneller geïrriteerd reageert. Herken je dat?",
      "Welke momenten geven jou op dit moment de meeste spanning?",
      "Wat zou jou helpen om je werk beter vol te houden?",
    ],
    avoid: [
      "Niet te snel conclusies trekken",
      "Niet wachten tot het escaleert",
      "Niet alleen over prestaties praten",
    ],
  },
  conflict: {
    nextStep:
      "Plan binnen enkele dagen een rustig gesprek met beide betrokkenen afzonderlijk. Benoem alleen wat je zelf hebt gezien of gehoord en kies nog geen kant.",
    why:
      "Bij oplopende spanning ontstaat vaak snel een patroon van misverstanden en aannames. Door eerst rustig feiten en beleving te bespreken, voorkom je verdere escalatie.",
    questions: [
      "Wat merk jij zelf dat er de laatste tijd moeilijker loopt?",
      "Welke situaties zorgen volgens jou voor de meeste spanning?",
      "Wat heb jij nodig om weer prettig samen te werken?",
    ],
    avoid: [
      "Niet meteen bepalen wie er gelijk heeft",
      "Niet beide medewerkers tegelijk confronteren",
      "Niet wachten tot het conflict groter wordt",
    ],
  },
  absence: {
    nextStep:
      "Plan binnen een week een kort en rustig gesprek over het patroon van de ziekmeldingen. Bespreek daarnaast of contact met de bedrijfsarts passend is.",
    why:
      "Regelmatige ziekmeldingen kunnen een signaal zijn dat er iets niet goed gaat, ook als iemand tussendoor blijft werken. Hoe eerder je het bespreekt, hoe groter de kans dat je samen iets kunt veranderen.",
    questions: [
      "Ik merk dat je je de laatste tijd vaker ziekmeldt. Herken je dat zelf ook?",
      "Zijn er bepaalde momenten of omstandigheden waarop het moeilijker gaat?",
      "Wat zou jou helpen om je werk beter vol te houden?",
    ],
    avoid: [
      "Niet doen alsof het alleen om motivatie gaat",
      "Niet alleen praten over aanwezigheid of cijfers",
      "Niet direct druk zetten op verandering",
    ],
  },
};

function pickScenario(input: string): Scenario {
  const normalized = input.toLowerCase();

  if (
    normalized.includes("conflict") ||
    normalized.includes("spanning") ||
    normalized.includes("ruzie")
  ) {
    return SCENARIOS.conflict;
  }

  if (
    normalized.includes("vaak ziek") ||
    normalized.includes("vaak afwezig") ||
    normalized.includes("regelmatig ziek")
  ) {
    return SCENARIOS.absence;
  }

  return SCENARIOS.overload;
}

function buildAdviceText(selectedScenario: Scenario) {
  return [
    "SignaalKompas",
    "",
    "Volgende stap",
    selectedScenario.nextStep,
    "",
    "Waarom deze stap zinvol is",
    selectedScenario.why,
    "",
    "Vragen voor het gesprek",
    ...selectedScenario.questions.map((q) => `- ${q}`),
    "",
    "Wat nu vermijden",
    ...selectedScenario.avoid.map((item) => `- ${item}`),
  ].join("\n");
}

function buildQuestionText(selectedScenario: Scenario) {
  return selectedScenario.questions.map((q) => `- ${q}`).join("\n");
}

export default function SignaalKompasMockup() {
  const [input, setInput] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [manualCopyText, setManualCopyText] = useState("");
  const [pdfState, setPdfState] = useState<"idle" | "building" | "done" | "blocked">("idle");
  const [manualCopyTitle, setManualCopyTitle] = useState("");
  const [showManualCopy, setShowManualCopy] = useState(false);
  const manualCopyRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedScenario = pickScenario(input);

  const adviceText = useMemo(() => buildAdviceText(selectedScenario), [selectedScenario]);
  const questionText = useMemo(() => buildQuestionText(selectedScenario), [selectedScenario]);

  const handleExampleClick = (example: string) => {
    setInput(example);
    setShowResult(false);
    setCopyState("idle");
  };

  const handleSubmit = () => {
    if (input.trim()) {
      setShowResult(true);
      setCopyState("idle");
    }
  };

  const handleReset = () => {
    setInput("");
    setShowResult(false);
    setCopyState("idle");
    setShowManualCopy(false);
  };

  const openManualCopyDialog = (title: string, text: string) => {
    setManualCopyTitle(title);
    setManualCopyText(text);
    setShowManualCopy(true);

    window.setTimeout(() => {
      manualCopyRef.current?.focus();
      manualCopyRef.current?.select();
    }, 50);
  };

  const copyViaHiddenTextarea = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    textArea.style.pointerEvents = "none";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    let success = false;
    try {
      success = document.execCommand("copy");
    } catch {
      success = false;
    }

    document.body.removeChild(textArea);
    return success;
  };

  const copyTextWithFallback = async (
    text: string,
    type: Exclude<CopyState, "idle">,
    title: string,
  ) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopyState(type);
        window.setTimeout(() => setCopyState("idle"), 1500);
        return;
      }
    } catch {
      // Fallback below
    }

    const copied = copyViaHiddenTextarea(text);
    if (copied) {
      setCopyState(type);
      window.setTimeout(() => setCopyState("idle"), 1500);
      return;
    }

    openManualCopyDialog(title, text);
  };

  const handleCopyAdvice = async () => {
    await copyTextWithFallback(adviceText, "advice", "Kopieer advies handmatig");
  };

  const handleCopyQuestions = async () => {
    await copyTextWithFallback(questionText, "questions", "Kopieer vragen handmatig");
  };

  const handleDownloadPdf = () => {
    setPdfState("building");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const left = 50;
    let y = 60;
    const lineGap = 18;
    const sectionGap = 22;
    const maxWidth = 495;

    const addWrappedText = (text: string, fontSize = 11) => {
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, left, y);
      y += lines.length * lineGap;
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("SignaalKompas", left, y);
    y += 30;

    doc.setFont("helvetica", "bold");
    addWrappedText("Volgende stap", 13);
    doc.setFont("helvetica", "normal");
    addWrappedText(selectedScenario.nextStep);
    y += sectionGap;

    doc.setFont("helvetica", "bold");
    addWrappedText("Waarom deze stap zinvol is", 13);
    doc.setFont("helvetica", "normal");
    addWrappedText(selectedScenario.why);
    y += sectionGap;

    doc.setFont("helvetica", "bold");
    addWrappedText("Vragen voor het gesprek", 13);
    doc.setFont("helvetica", "normal");
    selectedScenario.questions.forEach((q) => addWrappedText(`• ${q}`));
    y += sectionGap;

    doc.setFont("helvetica", "bold");
    addWrappedText("Wat nu vermijden", 13);
    doc.setFont("helvetica", "normal");
    selectedScenario.avoid.forEach((item) => addWrappedText(`• ${item}`));

        try {
      doc.save("signaalkompas-advies.pdf");
      setPdfState("done");
      window.setTimeout(() => setPdfState("idle"), 1500);
    } catch {
      setPdfState("blocked");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-800 md:p-12">
      <div className="mx-auto max-w-5xl space-y-10">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-700 shadow-sm">
              <div className="text-2xl text-white">🧭</div>
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">
                SignaalKompas
              </h1>
              <p className="mt-1 text-sm font-medium uppercase tracking-[0.2em] text-teal-700">
                Herken signalen. Kies de juiste volgende stap.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="max-w-3xl text-3xl font-semibold leading-tight text-slate-900">
              Binnen 5 minuten duidelijkheid als je je zorgen maakt over een medewerker.
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
              Maak je je zorgen over een medewerker? Beschrijf kort wat je ziet. SignaalKompas helpt je om de juiste volgende stap te kiezen.
            </p>

            <div className="mt-8">
              <p className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">
                Bijvoorbeeld situaties waarbij SignaalKompas kan helpen
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                {EXAMPLES.map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExampleClick(example)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left text-sm leading-relaxed text-slate-700 transition hover:border-teal-300 hover:bg-white"
                    type="button"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="min-h-[140px] w-full resize-none rounded-3xl border-2 border-slate-200 bg-slate-50 p-6 leading-relaxed text-slate-700 outline-none focus:border-teal-500"
                placeholder="Beschrijf kort wat er speelt, hoe lang dit al duurt, wat voor werk de medewerker doet en of iemand nog werkt of ziekgemeld is."
              />

              <p className="text-sm text-slate-500">
                Je hoeft geen medische details te weten. Beschrijf alleen wat je ziet of waar je je zorgen over maakt.
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleSubmit}
                  className="rounded-2xl bg-teal-700 px-8 py-4 text-lg font-medium text-white shadow-sm transition hover:bg-teal-800"
                  type="button"
                >
                  Toon volgende stap
                </button>
                <button
                  onClick={handleReset}
                  className="rounded-2xl border border-slate-200 bg-white px-6 py-4 font-medium text-slate-700 transition hover:border-slate-300"
                  type="button"
                >
                  Nieuwe situatie
                </button>
              </div>
            </div>
          </div>
        </div>

        {showResult && (
          <div className="space-y-5">
            <p className="text-sm font-medium text-slate-500">
              Op basis van wat je beschrijft, is dit waarschijnlijk de beste volgende stap.
            </p>

            <div className="rounded-3xl bg-teal-700 p-7 text-white shadow-md">
              <div className="mb-3 flex items-center gap-3">
                <span className="text-2xl">🧭</span>
                <h3 className="text-2xl font-semibold">Volgende stap</h3>
              </div>
              <p className="max-w-3xl text-lg leading-relaxed">
                {selectedScenario.nextStep}
              </p>
              <p className="mt-3 text-sm text-teal-100">Dit kun je nu direct doen.</p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-2xl">💡</span>
                  <h3 className="text-xl font-semibold">Waarom deze stap zinvol is</h3>
                </div>
                <p className="leading-relaxed text-slate-700">{selectedScenario.why}</p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">💬</span>
                    <h3 className="text-xl font-semibold">Vragen voor het gesprek</h3>
                  </div>
                  <button
                    className="text-sm font-medium text-teal-700"
                    onClick={handleCopyQuestions}
                    type="button"
                  >
                    {copyState === "questions" ? "Gekopieerd" : "Kopieer"}
                  </button>
                </div>
                <div className="space-y-3">
                  {selectedScenario.questions.map((q, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700"
                    >
                      “{q}”
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-100 p-6 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <h3 className="text-xl font-semibold">Wat nu vermijden</h3>
              </div>
              <ul className="space-y-2 text-slate-700">
                {selectedScenario.avoid.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-slate-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300"
                  onClick={handleCopyAdvice}
                  type="button"
                >
                  {copyState === "advice" ? "Advies gekopieerd" : "Kopieer advies"}
                </button>
                <button
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300"
                  onClick={handleDownloadPdf}
                  type="button"
                >
                  {pdfState === "building"
                    ? "PDF wordt gemaakt..."
                    : pdfState === "done"
                    ? "PDF gedownload"
                    : pdfState === "blocked"
                    ? "Download geblokkeerd"
                    : "Download als PDF"}
                </button>
              </div>
              {pdfState === "blocked" && (
                <p className="mt-4 text-sm text-slate-500">
                  PDF-generatie werkt, maar downloaden is in deze preview mogelijk beperkt.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-4">
            <span>Voor leidinggevenden</span>
            <span>Gebaseerd op de praktijk van de bedrijfsarts</span>
            <span>Geen medische of vertrouwelijke persoonsgegevens nodig</span>
          </div>
          <div className="max-w-xl text-slate-400 md:text-right">
            SignaalKompas geeft praktische ondersteuning bij medewerkerssituaties, maar vervangt geen bedrijfsarts, HR-advies of juridische beoordeling.
          </div>
        </div>
      </div>

      {showManualCopy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-xl font-semibold text-slate-900">{manualCopyTitle}</h3>
              <button
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                onClick={() => setShowManualCopy(false)}
                type="button"
              >
                Sluiten
              </button>
            </div>
            <p className="mb-3 text-sm text-slate-500">
              Kopiëren is in deze omgeving geblokkeerd. De tekst hieronder is automatisch geselecteerd zodat je die handmatig kunt kopiëren.
            </p>
            <textarea
              ref={manualCopyRef}
              readOnly
              value={manualCopyText}
              className="min-h-[260px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-relaxed text-slate-700 outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
