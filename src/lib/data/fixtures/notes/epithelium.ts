import type { StructuredContent } from "@/lib/content/schema";

export const epitheliumContent: StructuredContent = {
  schemaVersion: 1,
  subtitle: "Two questions classify almost every epithelium you will see",
  overview:
    "Epithelium is the tissue that covers body surfaces, lines cavities and tubes, and forms glands. Classifying it comes down to two questions: how many layers are there, and what shape are the cells at the surface?",
  learningObjectives: [
    "List the defining features of epithelial tissue.",
    "Classify an epithelium by number of layers and shape of surface cells.",
    "Give one typical location for each type of epithelium.",
    "Explain why pseudostratified epithelium is not truly stratified.",
  ],
  prerequisites: ["Basic cell structure (nucleus, cytoplasm, plasma membrane)."],
  references: [
    { id: "ross", citation: "Ross MH, Pawlina W. Histology: A Text and Atlas. Wolters Kluwer." },
    { id: "junqueira", citation: "Mescher AL. Junqueira's Basic Histology: Text and Atlas. McGraw Hill." },
  ],
  sections: [
    {
      id: "overview",
      title: "What makes a tissue epithelial?",
      kind: "overview",
      depth: "basic",
      preview: true,
      blocks: [
        {
          type: "paragraph",
          text: "Epithelia are sheets of closely packed cells with very little extracellular material between them. They form the boundary between the body and its environment: the skin surface, the lining of the gut, the airways and the inside of blood vessels.",
        },
        {
          type: "list",
          ordered: false,
          items: [
            "**Cellularity** – cells are tightly packed and joined by cell junctions.",
            "**Polarity** – each cell has an *apical* (free) surface and a *basal* surface.",
            "**Basement membrane** – the basal surface rests on a supporting basement membrane.",
            "**Avascularity** – epithelium has no blood vessels of its own; it is nourished by diffusion from underlying connective tissue.",
            "**Regeneration** – most epithelia are renewed continuously by cell division.",
          ],
        },
        {
          type: "explainer",
          technical:
            "Epithelium is avascular; oxygen and nutrients reach it by diffusion across the basement membrane from capillaries in the underlying lamina propria or dermis.",
          simplified:
            "Epithelium has no blood vessels inside it. It gets its supplies from the tissue just underneath, which is why it is usually thin enough for diffusion to work.",
        },
      ],
    },
    {
      id: "classification",
      title: "Classification from first principles",
      kind: "first-principles",
      depth: "basic",
      preview: true,
      blocks: [
        { type: "paragraph", text: "Ask two questions, in this order:" },
        {
          type: "diagram",
          title: "Naming an epithelium",
          layout: "flow",
          steps: [
            { label: "Count the layers", detail: "One layer = simple. More than one = stratified." },
            { label: "Look at the surface cells", detail: "Flat = squamous, as tall as wide = cuboidal, taller than wide = columnar." },
            { label: "Add special features", detail: "Cilia, microvilli (brush border), keratin, goblet cells." },
            { label: "Combine the words", detail: "e.g. stratified squamous keratinised epithelium." },
          ],
        },
        {
          type: "callout",
          variant: "tip",
          title: "Stratified epithelia are named by the top layer",
          text: "In stratified epithelium the deeper cells are often cuboidal or polygonal. Only the shape of the **surface** layer gives the name.",
        },
      ],
    },
    {
      id: "types",
      title: "Types and where to find them",
      kind: "comparisons",
      depth: "detailed",
      preview: false,
      blocks: [
        {
          type: "table",
          caption: "Common epithelia, a typical location and the function the structure suits",
          headers: ["Epithelium", "Typical locations", "Function suited to structure"],
          rows: [
            ["Simple squamous", "Lung alveoli, endothelium of vessels, mesothelium", "Diffusion and filtration across a thin barrier"],
            ["Simple cuboidal", "Kidney tubules, thyroid follicles, small ducts", "Secretion and absorption"],
            ["Simple columnar", "Stomach, small and large intestine, gallbladder", "Absorption and secretion; may carry microvilli"],
            ["Pseudostratified ciliated columnar", "Trachea and bronchi", "Moves mucus with cilia; goblet cells secrete mucus"],
            ["Stratified squamous keratinised", "Epidermis of skin", "Protection against abrasion and water loss"],
            ["Stratified squamous non-keratinised", "Oral cavity, oesophagus, vagina", "Protection of moist surfaces"],
            ["Stratified cuboidal", "Ducts of sweat glands", "Protection; limited secretion"],
            ["Transitional (urothelium)", "Ureters and urinary bladder", "Stretches as the bladder fills"],
          ],
        },
        {
          type: "definition",
          term: "Pseudostratified epithelium",
          definition:
            "A single layer of cells in which every cell rests on the basement membrane, but not every cell reaches the apical surface. Nuclei lie at different heights, so the layer looks stratified.",
          simplified: "It is one layer that only looks like several layers.",
        },
      ],
    },
    {
      id: "misconceptions",
      title: "Common misconceptions",
      kind: "misconceptions",
      depth: "mistake",
      preview: false,
      blocks: [
        {
          type: "callout",
          variant: "mistake",
          title: "\"Pseudostratified means many layers\"",
          text: "It is a **simple** epithelium. Look for whether every cell touches the basement membrane, not at how many rows of nuclei you see.",
        },
        {
          type: "callout",
          variant: "mistake",
          title: "\"Stratified squamous means every cell is flat\"",
          text: "Only the surface cells are flat. The basal layer is cuboidal to columnar and is where cell division happens.",
        },
      ],
    },
    {
      id: "high-yield",
      title: "High-yield revision points",
      kind: "high-yield",
      depth: "exam",
      preview: false,
      blocks: [
        {
          type: "list",
          ordered: false,
          items: [
            "Classification = number of layers + shape of the **surface** cells.",
            "Epithelium is avascular and rests on a basement membrane.",
            "Respiratory epithelium = pseudostratified ciliated columnar with goblet cells.",
            "Urinary bladder = transitional epithelium (urothelium).",
            "Skin = stratified squamous keratinised; oesophagus = non-keratinised.",
          ],
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
          question: "Which epithelium lines the lumen of the trachea?",
          options: [
            "Simple squamous",
            "Stratified squamous non-keratinised",
            "Pseudostratified ciliated columnar",
            "Transitional",
          ],
          answerIndex: 2,
          explanation:
            "The trachea is lined by respiratory epithelium: pseudostratified ciliated columnar epithelium with goblet cells. Cilia move the mucus layer towards the pharynx.",
        },
        {
          type: "mcq",
          question: "A tissue section shows a single layer of flat cells lining a capillary. What is it called?",
          options: ["Mesothelium", "Endothelium", "Urothelium", "Simple cuboidal epithelium"],
          answerIndex: 1,
          explanation:
            "The simple squamous epithelium lining blood vessels is called endothelium. Mesothelium is the simple squamous lining of serous cavities such as the pleura and peritoneum.",
        },
      ],
    },
    {
      id: "oral",
      title: "Oral examination questions",
      kind: "oral-questions",
      depth: "exam",
      preview: false,
      blocks: [
        {
          type: "question",
          kind: "oral",
          question: "How is epithelium nourished if it has no blood vessels?",
          answer:
            "By diffusion of oxygen and nutrients from capillaries in the underlying connective tissue, across the basement membrane.",
        },
        {
          type: "question",
          kind: "oral",
          question: "Why is the bladder lined by transitional epithelium?",
          answer:
            "Transitional epithelium can change its appearance as the bladder fills and empties. The surface cells flatten when the bladder is stretched, so the lining can accommodate large changes in volume while staying a barrier to urine.",
        },
      ],
    },
    {
      id: "summary",
      title: "Quick revision summary",
      kind: "summary",
      depth: "basic",
      preview: false,
      blocks: [
        {
          type: "paragraph",
          text: "Epithelium is a polarised, avascular sheet of cells on a basement membrane. Name it by counting layers (simple or stratified) and looking at the shape of the surface cells (squamous, cuboidal or columnar), then add special features such as cilia or keratin. Pseudostratified is a single layer that only appears layered; transitional epithelium is the stretchable lining of the urinary tract.",
        },
      ],
    },
  ],
};
