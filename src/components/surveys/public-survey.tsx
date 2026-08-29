"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Mic,
  Pause,
  RotateCcw,
  Star,
  Trash2,
} from "lucide-react";
import { visibleSurveyQuestions } from "@/lib/surveys/logic";
import type {
  SurveyAnswerValue,
  SurveyPublicDefinition,
  SurveyQuestion,
} from "@/lib/surveys/types";

type Stage = "intro" | "questions" | "feedback" | "contact" | "done";

function questionAnswered(
  question: SurveyQuestion,
  answer: SurveyAnswerValue | undefined,
) {
  if (!question.version.required) return true;
  if (answer?.notApplicable && question.version.allow_na) return true;
  if (typeof answer?.numericValue === "number") return true;
  if (answer?.textValue?.trim()) return true;
  if (typeof answer?.optionValue === "string") return Boolean(answer.optionValue);
  return Array.isArray(answer?.optionValue) && answer.optionValue.length > 0;
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion;
  value: SurveyAnswerValue | undefined;
  onChange: (value: SurveyAnswerValue) => void;
}) {
  const version = question.version;
  if (version.question_type === "STAR_5")
    return (
      <div>
        <div
          className="mt-7 flex justify-center gap-2 sm:gap-4"
          role="radiogroup"
          aria-label={version.title}
        >
          {[1, 2, 3, 4, 5].map((score) => {
            const selected = value?.numericValue === score;
            return (
              <button
                key={score}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${score} ${score === 1 ? "estrela" : "estrelas"}`}
                onClick={() => onChange({ numericValue: score })}
                className={`grid size-12 place-items-center rounded-2xl transition sm:size-16 ${selected ? "bg-[#087a4d] text-white shadow-lg shadow-emerald-900/15" : "bg-emerald-50 text-emerald-700 hover:-translate-y-0.5 hover:bg-emerald-100"}`}
              >
                <Star
                  size={selected ? 31 : 28}
                  fill={selected ? "currentColor" : "none"}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex justify-between text-xs text-slate-500">
          <span>Precisa melhorar</span>
          <span>Excelente</span>
        </div>
        {version.allow_na ? (
          <button
            type="button"
            onClick={() => onChange({ notApplicable: true })}
            className={`mx-auto mt-5 block rounded-full px-5 py-2 text-sm font-bold ${value?.notApplicable ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            Não se aplica
          </button>
        ) : null}
      </div>
    );
  if (version.question_type === "NPS_10")
    return (
      <div className="mt-7">
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
          {Array.from({ length: 11 }, (_, score) => (
            <button
              key={score}
              type="button"
              onClick={() => onChange({ numericValue: score })}
              className={`aspect-square rounded-xl text-sm font-extrabold transition ${value?.numericValue === score ? "bg-[#087a4d] text-white shadow-md" : "bg-emerald-50 text-emerald-900 hover:bg-emerald-100"}`}
              aria-pressed={value?.numericValue === score}
            >
              {score}
            </button>
          ))}
        </div>
        <div className="mt-3 flex justify-between text-xs text-slate-500">
          <span>Nada provável</span>
          <span>Muito provável</span>
        </div>
      </div>
    );
  if (
    version.question_type === "SINGLE_CHOICE" ||
    version.question_type === "MULTIPLE_CHOICE"
  ) {
    const multiple = version.question_type === "MULTIPLE_CHOICE";
    const selected = Array.isArray(value?.optionValue)
      ? value.optionValue
      : value?.optionValue
        ? [value.optionValue]
        : [];
    return (
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {version.options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() =>
                onChange({
                  optionValue: multiple
                    ? checked
                      ? selected.filter((item) => item !== option.value)
                      : [...selected, option.value]
                    : option.value,
                })
              }
              className={`min-h-14 rounded-2xl border px-4 text-left text-sm font-bold transition ${checked ? "border-emerald-700 bg-emerald-700 text-white" : "border-emerald-100 bg-white text-slate-700 hover:border-emerald-400"}`}
              aria-pressed={checked}
            >
              {checked ? <Check className="mr-2 inline" size={16} /> : null}
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <textarea
      value={value?.textValue ?? ""}
      onChange={(event) => onChange({ textValue: event.target.value })}
      rows={5}
      maxLength={1500}
      className="mt-6 w-full rounded-2xl border border-emerald-100 p-4 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
    />
  );
}

export function PublicSurvey({ survey }: { survey: SurveyPublicDefinition }) {
  const [stage, setStage] = useState<Stage>("intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, SurveyAnswerValue>>({});
  const [responseSession, setResponseSession] = useState<{
    responseId: string;
    responseToken: string;
  } | null>(null);
  const [feedbackMode, setFeedbackMode] = useState<"TEXT" | "AUDIO" | "NONE">(
    "NONE",
  );
  const [feedbackText, setFeedbackText] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [wantsContact, setWantsContact] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const visible = useMemo(
    () => visibleSurveyQuestions(survey.questions, survey.rules, answers),
    [survey.questions, survey.rules, answers],
  );
  const question = visible[index] ?? null;

  useEffect(() => {
    void fetch("/api/pesquisas/satisfacao/abrir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: survey.qrCode.token }),
    });
  }, [survey.qrCode.token]);

  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    },
    [audioUrl],
  );

  async function startSurvey() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/pesquisas/satisfacao/iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: survey.qrCode.token }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setResponseSession(result);
      setStage("questions");
    } catch {
      setError("Não foi possível iniciar agora. Tente novamente em instantes.");
    } finally {
      setSaving(false);
    }
  }

  function advance() {
    if (!question) return;
    if (!questionAnswered(question, answers[question.id])) {
      setError("Escolha uma resposta para continuar.");
      return;
    }
    setError("");
    if (index + 1 < visible.length) setIndex(index + 1);
    else setStage("feedback");
  }

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType: preferred });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        setRecording(false);
        if (timerRef.current) window.clearInterval(timerRef.current);
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecordingSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((seconds) => {
          if (seconds >= 89) recorder.stop();
          return Math.min(90, seconds + 1);
        });
      }, 1000);
    } catch {
      setError("Não foi possível acessar o microfone deste aparelho.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRecording(false);
  }

  function removeAudio() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl("");
    setRecordingSeconds(0);
  }

  async function finishSurvey() {
    if (!responseSession || saving) return;
    if (
      wantsContact &&
      (contactName.trim().length < 2 || contactPhone.replace(/\D/g, "").length < 10)
    ) {
      setError("Informe seu nome e um WhatsApp válido.");
      return;
    }
    setSaving(true);
    setError("");
    let uploaded:
      | { path: string; mimeType: string; duration: number }
      | undefined;
    try {
      if (feedbackMode === "AUDIO") {
        if (!audioBlob) throw new Error("Grave o áudio antes de enviar.");
        const form = new FormData();
        form.set("responseId", responseSession.responseId);
        form.set("responseToken", responseSession.responseToken);
        form.set("duration", String(Math.max(1, recordingSeconds)));
        form.set("audio", new File([audioBlob], "experiencia.webm", { type: "audio/webm" }));
        const audioResponse = await fetch(
          "/api/pesquisas/satisfacao/audio",
          { method: "POST", body: form },
        );
        const audioResult = await audioResponse.json();
        if (!audioResponse.ok) throw new Error(audioResult.error);
        uploaded = audioResult;
      }
      const submittedQuestions = visible.filter((item) => answers[item.id]);
      const response = await fetch("/api/pesquisas/satisfacao/concluir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...responseSession,
          answers: submittedQuestions.map((item) => ({
            questionId: item.id,
            questionVersionId: item.version.id,
            ...answers[item.id],
          })),
          feedback: {
            mode: feedbackMode,
            textContent: feedbackMode === "TEXT" ? feedbackText.trim() : undefined,
            audioStoragePath: uploaded?.path,
            audioMimeType: uploaded?.mimeType,
            audioDurationSeconds: uploaded?.duration,
          },
          contact: {
            wantsContact,
            name: wantsContact ? contactName.trim() : undefined,
            phone: wantsContact ? contactPhone : undefined,
          },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setStage("done");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível enviar sua avaliação.",
      );
    } finally {
      setSaving(false);
    }
  }

  const progress =
    stage === "questions" && visible.length
      ? Math.round(((index + 1) / visible.length) * 78)
      : stage === "feedback"
        ? 86
        : stage === "contact"
          ? 95
          : stage === "done"
            ? 100
            : 4;

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top,#e7fff3_0,#f8fffb_36%,#f7f8f8_100%)] px-4 py-5 text-slate-900 sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] max-w-2xl flex-col">
        <header className="flex items-center justify-between px-1">
          <p className="font-heading text-xl font-extrabold tracking-[0.08em] text-[#06452f]">
            INNEURO
          </p>
          <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-sm">
            {survey.unit?.name ?? "Experiência"}
          </span>
        </header>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-emerald-100">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <section className="my-auto py-6">
          {stage === "intro" ? (
            <div className="rounded-[2rem] border border-white/80 bg-white/90 p-6 text-center shadow-xl shadow-emerald-950/5 backdrop-blur sm:p-10">
              <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-emerald-100 text-3xl">
                💚
              </span>
              <h1 className="font-heading mt-6 text-3xl font-semibold text-[#063f2e] sm:text-4xl">
                Como foi sua experiência conosco?
              </h1>
              <p className="mx-auto mt-4 max-w-md leading-relaxed text-slate-600">
                Sua opinião nos ajuda a melhorar continuamente cada etapa da sua jornada.
              </p>
              <p className="mt-5 text-sm font-bold text-emerald-800">
                Leva menos de 1 minuto.
              </p>
              <button
                type="button"
                disabled={saving}
                onClick={startSurvey}
                className="mt-7 min-h-14 w-full rounded-full bg-[#087a4d] px-6 font-extrabold text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {saving ? "Preparando..." : "Começar avaliação"}
                <ChevronRight className="ml-2 inline" size={19} />
              </button>
            </div>
          ) : null}

          {stage === "questions" && question ? (
            <div className="rounded-[2rem] border border-white/80 bg-white/95 p-5 shadow-xl shadow-emerald-950/5 sm:p-9">
              <p className="text-xs font-extrabold tracking-[0.12em] text-emerald-700 uppercase">
                {question.version.category.replaceAll("_", " ")}
              </p>
              {question.version.description ? (
                <p className="mt-3 font-bold text-emerald-900">
                  {question.version.description}
                </p>
              ) : null}
              <h1 className="font-heading mt-3 text-2xl leading-tight font-semibold text-[#063f2e] sm:text-3xl">
                {question.version.title}
              </h1>
              <QuestionField
                question={question}
                value={answers[question.id]}
                onChange={(value) => {
                  setAnswers((current) => ({ ...current, [question.id]: value }));
                  setError("");
                }}
              />
              <div className="mt-8 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => setIndex(Math.max(0, index - 1))}
                  className="min-h-12 rounded-full px-4 text-sm font-bold text-slate-600 disabled:opacity-30"
                >
                  <ChevronLeft className="mr-1 inline" size={18} /> Voltar
                </button>
                <button
                  type="button"
                  onClick={advance}
                  className="min-h-12 rounded-full bg-[#087a4d] px-6 font-bold text-white"
                >
                  Continuar <ChevronRight className="ml-1 inline" size={18} />
                </button>
              </div>
            </div>
          ) : null}

          {stage === "feedback" ? (
            <div className="rounded-[2rem] bg-white p-6 shadow-xl shadow-emerald-950/5 sm:p-9">
              <p className="text-xs font-extrabold tracking-widest text-emerald-700 uppercase">
                Quase pronto
              </p>
              <h1 className="font-heading mt-3 text-3xl font-semibold text-[#063f2e]">
                Quer contar mais sobre sua experiência?
              </h1>
              <p className="mt-3 text-sm text-slate-600">
                Evite compartilhar diagnósticos, resultados de exames ou outras informações clínicas.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  ["TEXT", "✍️ Escrever"],
                  ["AUDIO", "🎤 Gravar áudio"],
                  ["NONE", "Pular"],
                ].map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFeedbackMode(mode as typeof feedbackMode)}
                    className={`min-h-12 rounded-2xl border px-4 text-sm font-bold ${feedbackMode === mode ? "border-emerald-700 bg-emerald-700 text-white" : "border-emerald-100"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {feedbackMode === "TEXT" ? (
                <label className="mt-5 block text-sm font-bold">
                  Seu comentário
                  <textarea
                    value={feedbackText}
                    onChange={(event) => setFeedbackText(event.target.value)}
                    maxLength={1500}
                    rows={5}
                    className="mt-2 w-full rounded-2xl border border-emerald-100 p-4 font-normal outline-none focus:border-emerald-600"
                  />
                  <span className="mt-1 block text-right text-xs font-normal text-slate-500">
                    {feedbackText.length}/1500
                  </span>
                </label>
              ) : null}
              {feedbackMode === "AUDIO" ? (
                <div className="mt-5 rounded-3xl bg-emerald-50 p-5 text-center">
                  {recording ? (
                    <>
                      <p className="font-heading text-3xl font-semibold text-emerald-900">
                        00:{String(recordingSeconds).padStart(2, "0")}
                      </p>
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="mt-4 rounded-full bg-rose-700 px-6 py-3 font-bold text-white"
                      >
                        <Pause className="mr-1 inline" size={17} /> Parar gravação
                      </button>
                    </>
                  ) : audioUrl ? (
                    <>
                      <audio controls src={audioUrl} className="w-full" />
                      <div className="mt-4 flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            removeAudio();
                            void startRecording();
                          }}
                          className="rounded-full bg-white px-4 py-2 text-sm font-bold text-emerald-800"
                        >
                          <RotateCcw className="mr-1 inline" size={15} /> Gravar novamente
                        </button>
                        <button
                          type="button"
                          onClick={removeAudio}
                          className="rounded-full bg-white px-4 py-2 text-sm font-bold text-rose-700"
                        >
                          <Trash2 className="mr-1 inline" size={15} /> Excluir
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-700 text-white shadow-lg"
                      aria-label="Iniciar gravação"
                    >
                      <Mic size={31} />
                    </button>
                  )}
                  <p className="mt-3 text-xs text-emerald-900/70">
                    Gravação privada de até 90 segundos.
                  </p>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (feedbackMode === "TEXT" && !feedbackText.trim()) {
                    setError("Escreva um comentário ou escolha Pular.");
                    return;
                  }
                  if (feedbackMode === "AUDIO" && !audioBlob) {
                    setError("Grave um áudio ou escolha Pular.");
                    return;
                  }
                  setError("");
                  setStage("contact");
                }}
                className="mt-7 min-h-12 w-full rounded-full bg-[#087a4d] font-bold text-white"
              >
                Continuar
              </button>
            </div>
          ) : null}

          {stage === "contact" ? (
            <div className="rounded-[2rem] bg-white p-6 shadow-xl shadow-emerald-950/5 sm:p-9">
              <h1 className="font-heading text-3xl font-semibold text-[#063f2e]">
                Gostaria que nossa equipe entrasse em contato sobre sua experiência?
              </h1>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setWantsContact(false)}
                  className={`min-h-12 rounded-2xl font-bold ${!wantsContact ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-900"}`}
                >
                  Não
                </button>
                <button
                  type="button"
                  onClick={() => setWantsContact(true)}
                  className={`min-h-12 rounded-2xl font-bold ${wantsContact ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-900"}`}
                >
                  Sim
                </button>
              </div>
              {wantsContact ? (
                <div className="mt-5 space-y-4">
                  <label className="block text-sm font-bold">
                    Nome
                    <input
                      value={contactName}
                      onChange={(event) => setContactName(event.target.value)}
                      maxLength={100}
                      autoComplete="name"
                      className="mt-2 min-h-12 w-full rounded-xl border border-emerald-100 px-4 font-normal"
                    />
                  </label>
                  <label className="block text-sm font-bold">
                    WhatsApp
                    <input
                      value={contactPhone}
                      onChange={(event) => setContactPhone(event.target.value)}
                      maxLength={20}
                      inputMode="tel"
                      autoComplete="tel"
                      className="mt-2 min-h-12 w-full rounded-xl border border-emerald-100 px-4 font-normal"
                    />
                  </label>
                  <p className="text-xs text-slate-500">
                    Ao enviar, você concorda que a INNEURO use estes dados somente para retornar sobre esta experiência.
                  </p>
                </div>
              ) : null}
              <button
                type="button"
                disabled={saving}
                onClick={finishSurvey}
                className="mt-7 min-h-14 w-full rounded-full bg-[#087a4d] font-extrabold text-white disabled:opacity-60"
              >
                {saving ? "Enviando com segurança..." : "Enviar avaliação"}
              </button>
            </div>
          ) : null}

          {stage === "done" ? (
            <div className="rounded-[2rem] bg-white p-7 text-center shadow-xl shadow-emerald-950/5 sm:p-12">
              <span className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-100 text-emerald-800">
                <Check size={38} />
              </span>
              <h1 className="font-heading mt-6 text-3xl font-semibold text-[#063f2e]">
                Avaliação enviada
              </h1>
              <p className="mt-4 leading-relaxed text-slate-600">
                Muito obrigado por compartilhar sua experiência.
                <br />
                Sua opinião nos ajuda a melhorar continuamente a qualidade dos nossos serviços.
              </p>
              <p className="mt-8 font-heading text-xl font-extrabold tracking-widest text-emerald-900">
                INNEURO
              </p>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="mt-4 rounded-2xl bg-rose-50 p-4 text-center text-sm font-bold text-rose-800">
              {error}
            </p>
          ) : null}
        </section>
        <footer className="px-3 pb-2 text-center text-xs leading-relaxed text-slate-500">
          Pesquisa anônima. Dados de contato são opcionais e usados somente com seu consentimento.
        </footer>
      </div>
    </main>
  );
}
