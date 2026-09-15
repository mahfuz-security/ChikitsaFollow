import { ArrowUp, Bot, RotateCcw, ShieldCheck, Sparkles, X } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useT, tx } from "../../lib/i18n/LocalizationProvider";
import { classifyGuideQuestion, GUIDE_ANSWERS, guideLocale, type GuideTopic } from "./guidance";
import { useCurrentUser } from "../profile/useCurrentUser";
import { rolesForUser } from "../profile/useHasRole";

type Message = { id: number; text: string; source: "user" | "guided" | "ai" };
const RobotMascot = lazy(() => import("./RobotMascot"));
export function GuidanceChat() {
  const { t, language } = useT();
  const me = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const [available, setAvailable] = useState(false);
  const [useAi, setUseAi] = useState(true);
  const [failed, setFailed] = useState(false);
  const [greeting, setGreeting] = useState(false);
  const controller = useRef<AbortController>();
  const bottom = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const composer = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 5000);
    composer.current?.focus();
    fetch("/api/assistant", { signal: abort.signal }).then(r => { if (!r.ok) throw new Error("unavailable"); return r.json(); })
      .then(data => { setAvailable(data?.mode === "ai"); })
      .catch(() => setAvailable(false));
    return () => { clearTimeout(timeout); abort.abort(); };
  }, [open]);
  useEffect(() => { bottom.current?.scrollIntoView?.({ block: "nearest" }); }, [messages, pending]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    function show() { setOpen(true); }
    window.addEventListener("chikitsa:help", show);
    return () => window.removeEventListener("chikitsa:help", show);
  }, []);

  async function ask(text: string, selected?: GuideTopic) {
    if (!text.trim() || controller.current) return;
    const topic = selected ?? classifyGuideQuestion(text);
    const fallback = GUIDE_ANSWERS[guideLocale(language)][topic];
    setMessages(current => [...current.slice(-18), { id: Date.now(), text: text.trim(), source: "user" }]);
    setInput("");
    setPending(true);
    setFailed(false);
    let answer: Message = { id: Date.now() + 1, text: fallback, source: "guided" };
    const request = new AbortController();
    controller.current = request;
    const timeout = setTimeout(() => request.abort(), 18_000);
    try {
      if (useAi) {
        const response = await fetch("/api/assistant", { method: "POST", signal: request.signal,
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, language, useAi }) });
        if (!response.ok) throw new Error("unavailable");
        const data = await response.json();
        if (typeof data.text !== "string" || !data.text.trim() || !["guided", "ai"].includes(data.source)) throw new Error("invalid_response");
        answer = { ...answer, text: data.text, source: data.source };
        if (controller.current === request) setFailed(data.degraded === true || (data.source === "guided" && topic !== "medical" && topic !== "privacy"));
      }
    } catch { if (controller.current === request) setFailed(true); }
    finally { clearTimeout(timeout); }
    if (controller.current === request) {
      setMessages(current => [...current, answer]);
      setPending(false);
      controller.current = undefined;
    }
  }

  function reset() { controller.current?.abort(); controller.current = undefined; setPending(false); setMessages([]); setInput(""); setFailed(false); composer.current?.focus(); }
  function close() { setOpen(false); launcher.current?.focus(); }
  return <>
    <button ref={launcher} className="help-launcher help-robot-launcher" type="button" title={t("help.title")} aria-label={t("help.title")} aria-haspopup="dialog" aria-expanded={open} aria-controls="guidance-panel" onMouseEnter={() => setGreeting(true)} onMouseLeave={() => setGreeting(false)} onFocus={() => setGreeting(true)} onBlur={() => setGreeting(false)} onClick={() => setOpen(value => !value)}><Suspense fallback={<Bot size={40} />}><RobotMascot mood={pending ? "thinking" : greeting ? "wave" : messages.length ? "happy" : "idle"} /></Suspense></button>
    {open ? <section id="guidance-panel" className="guide-panel" role="dialog" aria-modal="false" aria-labelledby="guidance-title" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      <header className="guide-header"><Bot size={24} /><div><h2 id="guidance-title">{t("help.title")}</h2><span>{t(available && useAi ? "help.ai" : "help.guided")}</span></div><button type="button" className="icon-button" onClick={reset} title={t("help.clear")} aria-label={t("help.clear")}><RotateCcw size={17} /></button><button type="button" className="icon-button" onClick={close} title={t("common.close")} aria-label={t("common.close")}><X size={20} /></button></header>
      <div className="guide-chat">
        <p className="guide-boundary"><ShieldCheck size={18} />{t("help.boundary")}</p>
        {rolesForUser(me.data?.data).includes("patient") ? <a href="/complaints" className="guide-complaint-link">{t("complaint.title")} <ArrowUp size={16} /></a> : null}
        <div className="guide-transcript" role="log" aria-label={t("help.conversation")} aria-live="polite">
          <div className="guide-message"><span className="guide-source"><Sparkles size={15} />{t("help.guided")}</span><p>{t("help.welcome")}</p></div>
          {messages.map(message => <div key={message.id} className={`guide-message guide-${message.source}`}>
            <span className="guide-source">{t(tx(`help.${message.source}`))}</span><p>{message.text}</p>
          </div>)}
          {pending ? <p role="status">{t("help.thinking")}</p> : null}<div ref={bottom} />
        {!messages.length ? <div className="guide-topics">{(["complaint", "status", "billing", "account"] as const).map(topic => <button type="button" key={topic} onClick={() => ask(t(tx(`help.topic.${topic}`)), topic)}>{t(tx(`help.topic.${topic}`))}</button>)}</div> : null}
        </div>
        {failed ? <p className="guide-error" role="status">{t("help.unavailable")}</p> : null}
        <label className="guide-optin"><input type="checkbox" checked={useAi} onChange={event => setUseAi(event.target.checked)} />{t("help.optin")}</label>
        <form className="guide-compose" onSubmit={event => { event.preventDefault(); void ask(input); }}>
          <input ref={composer} value={input} maxLength={500} onChange={event => setInput(event.target.value)} placeholder={t("help.placeholder")} aria-label={t("help.placeholder")} />
          <button type="submit" className="icon-button" disabled={pending || !input.trim()} title={t("help.send")} aria-label={t("help.send")}><ArrowUp size={22} /></button>
        </form>
        <div className="guide-footer"><span>{t("help.privacy")}</span></div>
      </div>
    </section> : null}
  </>;
}
