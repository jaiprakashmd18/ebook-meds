import type { StructuredContent } from "@/lib/content/schema";

export const glycolysisContent: StructuredContent = {
  schemaVersion: 1,
  subtitle: "Ten reactions, three control points, one clear story",
  overview:
    "Glycolysis splits one glucose molecule into two pyruvate molecules in the cytosol. It works with or without oxygen and gives a small but fast yield of ATP.",
  learningObjectives: [
    "Outline the ten steps of glycolysis in order.",
    "Identify the three irreversible steps and their regulation.",
    "Calculate the net ATP and NADH yield per glucose.",
    "Explain why red blood cells depend on glycolysis.",
    "Relate enzyme defects and poisons to their clinical effects.",
  ],
  prerequisites: ["Structure of glucose", "Role of ATP and NAD⁺ as cofactors"],
  references: [
    { id: "lehninger", citation: "Nelson DL, Cox MM. Lehninger Principles of Biochemistry. W. H. Freeman / Macmillan." },
    { id: "harper", citation: "Rodwell VW, et al. Harper's Illustrated Biochemistry. McGraw Hill." },
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
          text: "Glycolysis happens in the **cytosol** of every cell. Think of it in two halves: an *investment phase* that spends 2 ATP to prime and split glucose, and a *payoff phase* that earns 4 ATP and 2 NADH.",
        },
        {
          type: "equation",
          latex: "\\text{Glucose} + 2\\,\\text{NAD}^+ + 2\\,\\text{ADP} + 2\\,\\text{P}_i \\rightarrow 2\\,\\text{Pyruvate} + 2\\,\\text{NADH} + 2\\,\\text{H}^+ + 2\\,\\text{ATP} + 2\\,\\text{H}_2\\text{O}",
          fallbackText: "Glucose + 2 NAD⁺ + 2 ADP + 2 Pᵢ → 2 Pyruvate + 2 NADH + 2 H⁺ + 2 ATP + 2 H₂O",
          caption: "Net equation of glycolysis",
        },
      ],
    },
    {
      id: "why",
      title: "Why this topic matters",
      kind: "why-it-matters",
      depth: "basic",
      preview: true,
      blocks: [
        {
          type: "list",
          ordered: false,
          items: [
            "Red blood cells have no mitochondria, so glycolysis is their only source of ATP.",
            "Exercising skeletal muscle relies on glycolysis when oxygen delivery cannot keep up.",
            "Its control points explain how insulin, glucagon and energy status steer glucose use.",
          ],
        },
      ],
    },
    {
      id: "steps",
      title: "The ten steps",
      kind: "step-by-step",
      depth: "detailed",
      preview: false,
      blocks: [
        {
          type: "table",
          caption: "Irreversible steps are marked ✱",
          headers: ["#", "Reaction", "Enzyme", "Note"],
          rows: [
            ["1 ✱", "Glucose → glucose-6-phosphate", "Hexokinase (glucokinase in liver and β cells)", "Uses 1 ATP"],
            ["2", "Glucose-6-phosphate → fructose-6-phosphate", "Phosphoglucose isomerase", ""],
            ["3 ✱", "Fructose-6-phosphate → fructose-1,6-bisphosphate", "Phosphofructokinase-1 (PFK-1)", "Uses 1 ATP; committed, rate-limiting step"],
            ["4", "Fructose-1,6-bisphosphate → DHAP + glyceraldehyde-3-phosphate", "Aldolase", "6-carbon sugar split into two 3-carbon sugars"],
            ["5", "DHAP ⇌ glyceraldehyde-3-phosphate", "Triose phosphate isomerase", "From here, everything happens twice per glucose"],
            ["6", "Glyceraldehyde-3-phosphate → 1,3-bisphosphoglycerate", "Glyceraldehyde-3-phosphate dehydrogenase", "Produces NADH; uses inorganic phosphate"],
            ["7", "1,3-bisphosphoglycerate → 3-phosphoglycerate", "Phosphoglycerate kinase", "Substrate-level phosphorylation: 1 ATP"],
            ["8", "3-phosphoglycerate → 2-phosphoglycerate", "Phosphoglycerate mutase", ""],
            ["9", "2-phosphoglycerate → phosphoenolpyruvate", "Enolase", "Inhibited by fluoride"],
            ["10 ✱", "Phosphoenolpyruvate → pyruvate", "Pyruvate kinase", "Substrate-level phosphorylation: 1 ATP"],
          ],
        },
        {
          type: "diagram",
          title: "The pathway at a glance",
          layout: "flow",
          steps: [
            { label: "Glucose", detail: "Hexokinase, −1 ATP" },
            { label: "Fructose-1,6-bisphosphate", detail: "PFK-1, −1 ATP" },
            { label: "2 × Glyceraldehyde-3-phosphate", detail: "Aldolase + TPI" },
            { label: "2 × 1,3-Bisphosphoglycerate", detail: "+2 NADH" },
            { label: "2 × Phosphoenolpyruvate", detail: "+2 ATP" },
            { label: "2 × Pyruvate", detail: "Pyruvate kinase, +2 ATP" },
          ],
        },
      ],
    },
    {
      id: "yield",
      title: "Energy yield",
      kind: "first-principles",
      depth: "exam",
      preview: false,
      blocks: [
        {
          type: "table",
          headers: ["Phase", "ATP", "NADH"],
          rows: [
            ["Investment (steps 1 and 3)", "−2", "0"],
            ["Payoff (steps 7 and 10, twice each)", "+4", "+2 (step 6, twice)"],
            ["Net per glucose", "+2", "+2"],
          ],
        },
        {
          type: "callout",
          variant: "exam",
          title: "Remember the 'twice'",
          text: "After aldolase, each glucose gives two 3-carbon molecules, so every step from 6 to 10 happens twice. That is why the payoff phase makes 4 ATP, not 2.",
        },
      ],
    },
    {
      id: "regulation",
      title: "Regulation at the irreversible steps",
      kind: "mechanisms",
      depth: "advanced",
      preview: false,
      blocks: [
        {
          type: "table",
          headers: ["Enzyme", "Activated by", "Inhibited by"],
          rows: [
            ["Hexokinase", "—", "Glucose-6-phosphate (product)"],
            ["Glucokinase (liver, β cells)", "Insulin (induces synthesis)", "Not inhibited by glucose-6-phosphate"],
            ["PFK-1", "AMP, fructose-2,6-bisphosphate", "ATP, citrate"],
            ["Pyruvate kinase", "Fructose-1,6-bisphosphate (feed-forward)", "ATP, alanine; in liver, phosphorylation after glucagon signalling"],
          ],
        },
        {
          type: "definition",
          term: "Hexokinase vs glucokinase",
          definition:
            "Hexokinase has a low Km (high affinity) and is inhibited by its product, so it works well at normal glucose levels in most tissues. Glucokinase has a high Km (low affinity) and is not inhibited by glucose-6-phosphate, so the liver and pancreatic β cells keep taking up glucose when blood glucose is high.",
          simplified:
            "Hexokinase grabs glucose even when there is little around. Glucokinase only gets busy when there is plenty, which makes it a good glucose sensor.",
        },
      ],
    },
    {
      id: "anaerobic",
      title: "When oxygen is limited",
      kind: "clinical-relevance",
      depth: "clinical",
      preview: false,
      blocks: [
        {
          type: "paragraph",
          text: "Step 6 needs NAD^+^. Without oxygen, mitochondria cannot reoxidise NADH, so lactate dehydrogenase converts pyruvate to **lactate** and regenerates NAD^+^ in the cytosol. This keeps glycolysis running.",
        },
        {
          type: "callout",
          variant: "clinical",
          title: "Clinical links",
          text: "**Pyruvate kinase deficiency** reduces ATP production in red cells and causes haemolytic anaemia. **Fluoride** inhibits enolase, which is why fluoride tubes are used to stop glycolysis in blood glucose samples. **Arsenate** competes with phosphate at step 6, so the ATP normally made at step 7 is lost.",
        },
        {
          type: "callout",
          variant: "note",
          title: "Red cells and 2,3-BPG",
          text: "In red blood cells, some 1,3-bisphosphoglycerate is diverted to 2,3-bisphosphoglycerate (the Rapoport–Luebering shunt). 2,3-BPG lowers haemoglobin's affinity for oxygen and helps unload O~2~ in tissues, at the cost of the ATP from step 7.",
        },
      ],
    },
    {
      id: "mnemonics",
      title: "Mnemonic",
      kind: "mnemonics",
      depth: "exam",
      preview: false,
      blocks: [
        {
          type: "callout",
          variant: "mnemonic",
          title: "Irreversible steps: \"1, 3, 10\"",
          text: "Steps **1** (hexokinase), **3** (PFK-1) and **10** (pyruvate kinase) are the one-way steps. Gluconeogenesis needs separate enzymes to bypass exactly these three.",
        },
      ],
    },
    {
      id: "mcqs",
      title: "Practice MCQs",
      kind: "practice-mcqs",
      depth: "exam",
      preview: false,
      blocks: [
        {
          type: "mcq",
          question: "Which enzyme catalyses the committed, rate-limiting step of glycolysis?",
          options: ["Hexokinase", "Phosphofructokinase-1", "Aldolase", "Pyruvate kinase"],
          answerIndex: 1,
          explanation:
            "PFK-1 converts fructose-6-phosphate to fructose-1,6-bisphosphate. Once this step happens the molecule is committed to glycolysis, and PFK-1 is the main point of regulation.",
        },
        {
          type: "mcq",
          question: "What is the net ATP yield of glycolysis from one molecule of glucose?",
          options: ["1", "2", "4", "36"],
          answerIndex: 1,
          explanation: "4 ATP are produced in the payoff phase but 2 are spent in the investment phase, so the net yield is 2 ATP.",
        },
        {
          type: "mcq",
          question: "Blood for glucose estimation is collected in fluoride tubes because fluoride inhibits:",
          options: ["Hexokinase", "Glyceraldehyde-3-phosphate dehydrogenase", "Enolase", "Lactate dehydrogenase"],
          answerIndex: 2,
          explanation:
            "Fluoride inhibits enolase. This stops glycolysis in the cells of the sample, so the glucose concentration does not fall before analysis.",
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
            "Cytosolic, oxygen-independent pathway: glucose → 2 pyruvate.",
            "Net yield: 2 ATP and 2 NADH per glucose.",
            "Irreversible steps: hexokinase/glucokinase, PFK-1 (rate-limiting), pyruvate kinase.",
            "Without O~2~, pyruvate → lactate regenerates NAD^+^.",
            "RBCs rely entirely on glycolysis; PK deficiency causes haemolytic anaemia.",
          ],
        },
      ],
    },
  ],
};
