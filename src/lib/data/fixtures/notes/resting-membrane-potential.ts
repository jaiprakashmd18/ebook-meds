import type { StructuredContent } from "@/lib/content/schema";

export const rmpContent: StructuredContent = {
  schemaVersion: 1,
  subtitle: "Why the inside of a cell is negative, explained without hand-waving",
  overview:
    "Every living cell has a voltage across its membrane, with the inside negative relative to the outside. In nerve and muscle this resting membrane potential is the starting point for every action potential.",
  learningObjectives: [
    "Define the resting membrane potential and give typical values.",
    "Explain why K⁺ is the main determinant of the resting potential.",
    "Use the Nernst equation to calculate an equilibrium potential.",
    "Describe the role of the Na⁺/K⁺ ATPase.",
    "Predict the effect of changes in plasma K⁺ on excitability.",
  ],
  prerequisites: ["Diffusion and concentration gradients", "Ion channels", "The Na⁺/K⁺ ATPase"],
  references: [
    { id: "guyton", citation: "Hall JE, Hall ME. Guyton and Hall Textbook of Medical Physiology. Elsevier." },
    { id: "ganong", citation: "Barrett KE, et al. Ganong's Review of Medical Physiology. McGraw Hill." },
  ],
  sections: [
    {
      id: "overview",
      title: "Overview",
      kind: "overview",
      depth: "basic",
      preview: true,
      blocks: [
        {
          type: "paragraph",
          text: "The resting membrane potential (RMP) is the potential difference across the membrane of a cell at rest, measured inside relative to outside. Typical values are around **−70 mV** in many neurons and about **−90 mV** in skeletal muscle and large nerve fibres.",
        },
        {
          type: "explainer",
          technical:
            "The RMP arises mainly because the resting membrane is far more permeable to K⁺ than to Na⁺, so K⁺ diffusing out of the cell down its concentration gradient leaves behind unbalanced negative charge.",
          simplified:
            "Potassium leaks out of the cell much more easily than sodium leaks in. Each K⁺ that leaves takes a positive charge with it, so the inside ends up negative.",
        },
      ],
    },
    {
      id: "gradients",
      title: "The ion gradients",
      kind: "first-principles",
      depth: "basic",
      preview: true,
      blocks: [
        {
          type: "table",
          caption: "Approximate concentrations in mammalian nerve (mmol/L); values vary between sources",
          headers: ["Ion", "Outside", "Inside"],
          rows: [
            ["Na⁺", "142", "14"],
            ["K⁺", "4", "140"],
            ["Cl⁻", "~105", "~5–10"],
          ],
        },
        {
          type: "paragraph",
          text: "The Na^+^/K^+^ ATPase builds and maintains these gradients by moving 3 Na^+^ out and 2 K^+^ in for each ATP.",
        },
      ],
    },
    {
      id: "nernst",
      title: "The Nernst equation",
      kind: "mechanisms",
      depth: "detailed",
      preview: false,
      blocks: [
        {
          type: "paragraph",
          text: "For a single ion, the **equilibrium potential** is the voltage at which the electrical force exactly balances the concentration gradient, so there is no net movement of that ion.",
        },
        {
          type: "equation",
          latex: "E_{\\text{ion}} = \\frac{61.5}{z}\\,\\log_{10}\\frac{[\\text{ion}]_{\\text{out}}}{[\\text{ion}]_{\\text{in}}}\\ \\text{mV}",
          fallbackText: "E(ion) = (61.5 / z) × log₁₀([ion]out / [ion]in) mV, at 37 °C",
          caption: "Simplified Nernst equation at body temperature; z is the charge of the ion.",
        },
        {
          type: "table",
          headers: ["Ion", "Calculation", "Equilibrium potential"],
          rows: [
            ["K⁺", "61.5 × log₁₀(4/140)", "≈ −95 mV"],
            ["Na⁺", "61.5 × log₁₀(142/14)", "≈ +62 mV"],
          ],
        },
        {
          type: "callout",
          variant: "exam",
          title: "Why the RMP is close to, but not equal to, E(K⁺)",
          text: "At rest the membrane is mostly permeable to K^+^, so the RMP sits near the K^+^ equilibrium potential. A small Na^+^ permeability pulls it slightly towards E(Na^+^), which is why a typical neuron rests at about −70 mV rather than −95 mV.",
        },
        {
          type: "equation",
          latex: "V_m = 61.5\\,\\log_{10}\\frac{P_K[K^+]_o + P_{Na}[Na^+]_o + P_{Cl}[Cl^-]_i}{P_K[K^+]_i + P_{Na}[Na^+]_i + P_{Cl}[Cl^-]_o}",
          fallbackText: "Vm = 61.5 × log₁₀((PK[K⁺]o + PNa[Na⁺]o + PCl[Cl⁻]i) / (PK[K⁺]i + PNa[Na⁺]i + PCl[Cl⁻]o))",
          caption: "Goldman–Hodgkin–Katz equation: each ion contributes in proportion to its permeability (P). Note that Cl⁻ is inverted because of its negative charge.",
        },
      ],
    },
    {
      id: "pump",
      title: "What the Na⁺/K⁺ ATPase really does",
      kind: "misconceptions",
      depth: "mistake",
      preview: false,
      blocks: [
        {
          type: "callout",
          variant: "mistake",
          title: "\"The pump creates the resting potential\"",
          text: "The pump is electrogenic and contributes only a few millivolts directly. Its main role is to **maintain the concentration gradients**. The potential itself comes from ions diffusing through leak channels.",
        },
        {
          type: "callout",
          variant: "note",
          title: "Very few ions move",
          text: "Only a tiny fraction of the K^+^ inside the cell needs to cross the membrane to set up the resting potential. Bulk concentrations inside and outside are essentially unchanged.",
        },
      ],
    },
    {
      id: "clinical",
      title: "Clinical relevance: plasma potassium",
      kind: "clinical-relevance",
      depth: "clinical",
      preview: false,
      blocks: [
        {
          type: "table",
          headers: ["Change", "Effect on E(K⁺) and RMP", "Consequence"],
          rows: [
            ["Hyperkalaemia (↑ plasma K⁺)", "Smaller K⁺ gradient; RMP less negative (depolarised)", "Excitability rises at first; sustained depolarisation inactivates Na⁺ channels. Risk of dangerous cardiac arrhythmias."],
            ["Hypokalaemia (↓ plasma K⁺)", "Larger K⁺ gradient; RMP more negative (hyperpolarised)", "Cells are harder to excite; muscle weakness and arrhythmias can occur."],
          ],
        },
        {
          type: "callout",
          variant: "clinical",
          title: "Caution",
          text: "This note explains mechanisms for learning. Recognition and management of potassium disorders must follow current clinical guidelines and supervision.",
        },
      ],
    },
    {
      id: "questions",
      title: "Practice questions",
      kind: "practice-mcqs",
      depth: "exam",
      preview: false,
      blocks: [
        {
          type: "mcq",
          question: "The resting membrane potential of a neuron is closest to the equilibrium potential of which ion?",
          options: ["Na⁺", "K⁺", "Ca²⁺", "Cl⁻ in every neuron"],
          answerIndex: 1,
          explanation: "At rest, K^+^ permeability dominates, so the membrane potential lies close to E(K^+^).",
        },
        {
          type: "question",
          kind: "short-answer",
          question: "Why does a rise in extracellular K⁺ depolarise the membrane?",
          answer:
            "Raising [K⁺] outside reduces the concentration gradient driving K⁺ out of the cell. By the Nernst equation, E(K⁺) becomes less negative, and because the resting membrane is mainly permeable to K⁺, the RMP moves with it.",
        },
        {
          type: "question",
          kind: "oral",
          question: "If you blocked the Na⁺/K⁺ ATPase, would the resting potential disappear immediately?",
          answer:
            "No. The small direct electrogenic contribution would be lost at once, but the gradients only run down slowly, so the RMP declines gradually as the gradients dissipate.",
        },
      ],
    },
    {
      id: "summary",
      title: "Quick revision summary",
      kind: "summary",
      depth: "exam",
      preview: false,
      blocks: [
        {
          type: "list",
          ordered: false,
          items: [
            "RMP ≈ −70 mV (many neurons) to −90 mV (skeletal muscle, large fibres).",
            "Main cause: K⁺ efflux through leak channels; resting membrane is far more permeable to K⁺ than Na⁺.",
            "Nernst: E(K⁺) ≈ −95 mV, E(Na⁺) ≈ +62 mV with typical concentrations.",
            "Na⁺/K⁺ ATPase: 3 Na⁺ out, 2 K⁺ in; maintains gradients, small direct contribution.",
            "Hyperkalaemia depolarises; hypokalaemia hyperpolarises.",
          ],
        },
      ],
    },
  ],
};
