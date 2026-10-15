import React from "react";
import { Link } from "react-router-dom";
import { BrainCircuit, Calculator, Droplets, MessageSquare, Radio, Ruler, ScanLine, Sparkles, Waves } from "lucide-react";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import Brand from "@/components/layout/Brand";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import ProvenanceBadge from "@/components/common/ProvenanceBadge";
import { useI18n } from "@/lib/i18n";

const HERO_IMAGE =
  "https://media.base44.com/images/public/6acc6c823ef727be462c3d09/7a55b9f4a_generated_image.png";

const CAPABILITIES = [
  {
    Icon: Sparkles,
    title: "Crop recommendation",
    body: "Your soil test and climate values are compared with documented requirement ranges for 17 field crops and returned as a ranked shortlist, with the limiting factor written out for each one.",
    badge: <ProvenanceBadge kind="rule" />,
  },
  {
    Icon: ScanLine,
    title: "Plant photo check",
    body: "Upload a leaf or plant photo and a vision model reads it, giving observations, first steps and an honest confidence. If the photo is unclear or the plant is not what you said, it says inconclusive instead of guessing.",
    badge: <ProvenanceBadge kind="modelled" />,
  },
  {
    Icon: MessageSquare,
    title: "Farming assistant",
    body: "Ask about irrigation, stages, pests or soil preparation. Answers are generated live and grounded in the farm records you have already entered — with no invented citations.",
    badge: <ProvenanceBadge kind="modelled" />,
  },
  {
    Icon: Radio,
    title: "Monitoring and irrigation",
    body: "Soil moisture, temperature, humidity and light readings are stored with their source and timestamp. Stale values are flagged, and irrigation advice explains the exact rule that fired.",
    badge: <ProvenanceBadge kind="simulated" />,
  },
];

const LABELS = [
  { kind: "measured", text: "values a person or a sensor actually measured" },
  { kind: "modelled", text: "output produced by a model, never presented as a fact" },
  { kind: "rule", text: "decisions from transparent thresholds, not machine learning" },
  { kind: "simulated", text: "demo sensor data, clearly marked wherever it appears" },
];

const LIMITS = [
  "This build runs on the platform's React front end, managed database and serverless functions. The Python / FastAPI / PostgreSQL / PyTorch stack in the original specification cannot execute in this environment, so the same four capabilities are implemented natively.",
  "Crop advice is a documented rule engine, not a trained scikit-learn model, so no accuracy figure is claimed anywhere in the app. A trained model can be connected later through the same endpoint.",
  "Plant photos are read by a general-purpose vision model, not a crop-specific trained classifier, and the app states that on every result. No chemical dosage is ever suggested.",
  "Sensor values are simulated until a real device posts readings. The authenticated ingestion endpoint is live, but it needs a device token configured before a physical ESP32 or ESP8266 node can send anything.",
  "An MQTT bridge and scheduled reports are not built yet; the sensor readings stored for a farm can be downloaded as a CSV file for offline analysis. The administration console and its audit trail are built: every record change and every engine action is written to an append-only history that only a signed-in administrator can read. Live conditions and rainfall come from MET Norway's public forecast, labelled as model output for the nearest grid cell; a rainfall figure you type in overrides it and is then labelled as hand-entered.",
];

export default function Landing() {
  const { t } = useI18n();

  return (
    <div className="bg-background">
      <section className="relative isolate overflow-hidden bg-primary">
        <Image src={HERO_IMAGE} alt="" className="absolute inset-0 h-full w-full" fittingType="fill" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b2a1f]/95 via-[#14432f]/88 to-[#1d6f4f]/70" />

        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-6 sm:px-8 sm:pb-28 sm:pt-8 lg:px-10">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2.5 text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                <Droplets className="h-5 w-5 text-emerald-100" />
              </span>
              <span className="font-display text-base font-semibold tracking-tight">AgriSmart AI</span>
            </span>
            <div className="flex items-center gap-3">
              <LanguageSwitcher showLabel={false} />
              <Button asChild variant="secondary" size="sm" className="bg-white/95 text-primary hover:bg-white">
                <Link to="/dashboard">{t("Open the dashboard")}</Link>
              </Button>
            </div>
          </div>

          <div className="mt-16 max-w-3xl sm:mt-24">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-200/90">
              {t("Crop records · model advice · live field data")}
            </p>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl">
              {t("Know your soil, your crop and your field — before the season decides for you.")}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-emerald-50/90 sm:text-lg">
              {t(
                "AgriSmart AI keeps your farm records, turns them into crop and irrigation advice, reads a plant photo when something looks wrong, and shows what your sensors are reporting. Every number is labelled so you always know whether it was measured, calculated, predicted, or simulated."
              )}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-white text-primary hover:bg-emerald-50">
                <Link to="/dashboard">{t("Start with a farm")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link to="/assistant">{t("Ask the assistant")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t("Four capabilities, kept honest about what they are")}
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {CAPABILITIES.map(({ Icon, title, body, badge }) => (
            <article key={title} className="rounded-2xl border border-border bg-card p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{t(title)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(body)}</p>
              <div className="mt-4">{badge}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                {t("Four labels, so nothing is dressed up")}
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {t(
                  "A forecast that looks like a measurement is worse than no forecast. Every value in this app carries its origin, and simulated data never appears as a real reading."
                )}
              </p>
            </div>
            <ul className="space-y-4">
              {LABELS.map(({ kind, text }) => (
                <li key={kind} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
                  <ProvenanceBadge kind={kind} />
                  <span className="text-sm text-muted-foreground">{t(text)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          {t("What is built, and what is not")}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {t("Stated plainly rather than buried, so you know exactly what you are trusting.")}
        </p>
        <ul className="mt-8 space-y-4">
          {LIMITS.map((line) => (
            <li key={line} className="flex gap-3 rounded-2xl border border-border bg-card p-5 text-sm leading-relaxed text-muted-foreground">
              <Waves className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {t(line)}
            </li>
          ))}
        </ul>
      </section>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <Brand />
          <div className="flex flex-wrap items-center gap-2">
            <ProvenanceBadge kind="measured" />
            <ProvenanceBadge kind="rule" />
            <ProvenanceBadge kind="modelled" />
            <ProvenanceBadge kind="simulated" />
          </div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Ruler className="h-3.5 w-3.5" />{" "}
            {t("Advice for decisions, not a substitute for your extension officer.")}
          </p>
        </div>
      </footer>
    </div>
  );
}