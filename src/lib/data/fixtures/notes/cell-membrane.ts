import type { StructuredContent } from "@/lib/content/schema";

export const cellMembraneContent: StructuredContent = {
  schemaVersion: 1,
  subtitle: "How substances cross the plasma membrane, and what it costs",
  overview:
    "The plasma membrane separates the inside of the cell from its surroundings. It lets some substances through freely, others only through specific proteins, and some only when the cell spends energy.",
  learningObjectives: [
    "Describe the fluid mosaic model of the plasma membrane.",
    "Distinguish passive from active transport.",
    "Explain primary and secondary active transport with examples.",
    "State the factors that affect the rate of simple diffusion.",
  ],
  prerequisites: ["Concentration gradients", "Basic idea of ATP as the energy currency of the cell."],
  references: [
    { id: "guyton", citation: "Hall JE, Hall ME. Guyton and Hall Textbook of Medical Physiology. Elsevier." },
    { id: "alberts", citation: "Alberts B, et al. Molecular Biology of the Cell. W. W. Norton." },
  ],
  sections: [
    {
      id: "structure",
      title: "Structure: the fluid mosaic model",
      kind: "overview",
      depth: "basic",
      preview: true,
      blocks: [
        {
          type: "paragraph",
          text: "The membrane is a **phospholipid bilayer**. Each phospholipid is *amphipathic*: it has a water-loving (hydrophilic) head and water-fearing (hydrophobic) fatty acid tails. In water the tails face inwards and the heads face the fluid on either side.",
        },
        {
          type: "list",
          ordered: false,
          items: [
            "**Integral proteins** span the bilayer and form channels, carriers and pumps.",
            "**Peripheral proteins** attach to one surface and often act as enzymes or anchors.",
            "**Cholesterol** sits between phospholipids and stabilises fluidity across temperatures.",
            "**Carbohydrates** attached to proteins and lipids on the outer surface form the *glycocalyx*, which is involved in cell recognition.",
          ],
        },
        {
          type: "explainer",
          technical:
            "The fluid mosaic model describes the membrane as a two-dimensional fluid of lipids in which proteins are embedded and can diffuse laterally.",
          simplified:
            "Think of the membrane as a thin film of oil floating on water, with proteins bobbing in it like boats that can drift sideways.",
        },
      ],
    },
    {
      id: "passive",
      title: "Passive transport",
      kind: "first-principles",
      depth: "basic",
      preview: true,
      blocks: [
        {
          type: "paragraph",
          text: "Passive transport moves substances **down** their electrochemical gradient. It needs no metabolic energy.",
        },
        {
          type: "definition",
          term: "Simple diffusion",
          definition:
            "Movement of molecules directly through the lipid bilayer or through open channels, down a concentration gradient, without binding to a carrier.",
          simplified: "Molecules spread from where there are more of them to where there are fewer.",
        },
        {
          type: "paragraph",
          text: "Small lipid-soluble molecules such as O~2~, CO~2~ and many anaesthetic gases cross the bilayer easily. Ions such as Na^+^ and K^+^ need protein channels.",
        },
        {
          type: "equation",
          latex: "J = -D \\, A \\, \\frac{\\Delta C}{\\Delta x}",
          fallbackText: "J = −D × A × (ΔC / Δx)",
          caption: "Fick's law: diffusion rate J rises with the diffusion coefficient D, surface area A and concentration difference ΔC, and falls as membrane thickness Δx increases.",
        },
        {
          type: "definition",
          term: "Facilitated diffusion",
          definition:
            "Carrier-mediated movement down a concentration gradient. The carrier protein binds the substance and changes shape to release it on the other side. Glucose entry through GLUT transporters is the classic example.",
        },
        {
          type: "callout",
          variant: "exam",
          title: "Carrier-mediated transport shows saturation",
          text: "Because the number of carriers is limited, facilitated diffusion reaches a maximum rate (V~max~) as concentration rises. Simple diffusion does not saturate. Carriers also show **specificity** and **competition** between similar molecules.",
        },
      ],
    },
    {
      id: "active",
      title: "Active transport",
      kind: "mechanisms",
      depth: "detailed",
      preview: false,
      blocks: [
        {
          type: "paragraph",
          text: "Active transport moves substances **against** their electrochemical gradient. It needs energy, either directly from ATP or indirectly from an ion gradient that ATP created.",
        },
        { type: "heading", level: 3, text: "Primary active transport" },
        {
          type: "paragraph",
          text: "The carrier itself hydrolyses ATP. The Na^+^/K^+^ ATPase pumps **3 Na^+^ out** and **2 K^+^ in** for each ATP used. Because more positive charge leaves than enters, the pump is *electrogenic*.",
        },
        { type: "heading", level: 3, text: "Secondary active transport" },
        {
          type: "paragraph",
          text: "Energy stored in the Na^+^ gradient (created by the Na^+^/K^+^ ATPase) drives another substance uphill.",
        },
        {
          type: "table",
          headers: ["Type", "Direction", "Example"],
          rows: [
            ["Co-transport (symport)", "Both substances move the same way", "SGLT1: Na⁺ and glucose into intestinal cells"],
            ["Counter-transport (antiport)", "Substances move in opposite directions", "Na⁺/Ca²⁺ exchanger removing Ca²⁺ from cardiac cells"],
          ],
        },
        {
          type: "callout",
          variant: "mistake",
          title: "Secondary active transport still depends on ATP",
          text: "It does not use ATP directly, but if the Na^+^/K^+^ ATPase stops (for example in severe hypoxia), the Na^+^ gradient runs down and secondary active transport fails too.",
        },
      ],
    },
    {
      id: "vesicular",
      title: "Vesicular transport",
      kind: "step-by-step",
      depth: "detailed",
      preview: false,
      blocks: [
        {
          type: "list",
          ordered: false,
          items: [
            "**Endocytosis** brings material in by folding the membrane around it: phagocytosis (particles), pinocytosis (fluid) and receptor-mediated endocytosis (specific molecules such as LDL).",
            "**Exocytosis** releases vesicle contents, for example neurotransmitters and hormones.",
          ],
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
          type: "table",
          headers: ["Mechanism", "Energy", "Carrier", "Saturates?"],
          rows: [
            ["Simple diffusion", "None", "No", "No"],
            ["Facilitated diffusion", "None", "Yes", "Yes"],
            ["Primary active", "ATP directly", "Yes (pump)", "Yes"],
            ["Secondary active", "Ion gradient", "Yes", "Yes"],
          ],
        },
        {
          type: "mcq",
          question: "Glucose absorption by SGLT1 in the small intestine is an example of:",
          options: ["Simple diffusion", "Facilitated diffusion", "Primary active transport", "Secondary active transport"],
          answerIndex: 3,
          explanation:
            "SGLT1 couples glucose entry to Na^+^ moving down its gradient into the cell. The gradient is maintained by the Na^+^/K^+^ ATPase, so this is secondary active co-transport.",
        },
      ],
    },
  ],
};
