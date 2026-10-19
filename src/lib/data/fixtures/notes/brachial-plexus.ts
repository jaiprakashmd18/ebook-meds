import type { StructuredContent } from "@/lib/content/schema";

export const brachialPlexusContent: StructuredContent = {
  schemaVersion: 1,
  subtitle: "Roots to branches, with the injuries that examiners ask about",
  overview:
    "The brachial plexus is the network of nerves that supplies the upper limb. Once you see it as five stages, it stops being a tangle and becomes a predictable map.",
  learningObjectives: [
    "Name the roots that form the brachial plexus.",
    "Describe how roots form trunks, divisions and cords.",
    "List the five terminal branches and their root values.",
    "Explain the deformities in Erb's and Klumpke's palsy.",
  ],
  prerequisites: ["Spinal nerves and ventral rami", "Axillary artery and its parts"],
  references: [
    { id: "grays-students", citation: "Drake RL, Vogl AW, Mitchell AWM. Gray's Anatomy for Students. Elsevier." },
    { id: "moore", citation: "Moore KL, Dalley AF, Agur AMR. Clinically Oriented Anatomy. Wolters Kluwer." },
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
          text: "The plexus is formed by the **ventral rami of C5, C6, C7, C8 and T1**. It begins in the neck, passes over the first rib and enters the axilla, where it surrounds the axillary artery.",
        },
        {
          type: "diagram",
          title: "Five stages",
          layout: "flow",
          steps: [
            { label: "Roots (5)", detail: "C5, C6, C7, C8, T1" },
            { label: "Trunks (3)", detail: "Upper, middle, lower" },
            { label: "Divisions (6)", detail: "Anterior and posterior from each trunk" },
            { label: "Cords (3)", detail: "Lateral, medial, posterior" },
            { label: "Terminal branches (5)", detail: "Musculocutaneous, median, ulnar, axillary, radial" },
          ],
        },
        {
          type: "callout",
          variant: "mnemonic",
          title: "\"Read That Damn Cadaver Book\"",
          text: "**R**oots, **T**runks, **D**ivisions, **C**ords, **B**ranches.",
        },
      ],
    },
    {
      id: "formation",
      title: "How the parts join",
      kind: "step-by-step",
      depth: "detailed",
      preview: false,
      blocks: [
        {
          type: "table",
          headers: ["Part", "Formed from"],
          rows: [
            ["Upper trunk", "C5 + C6"],
            ["Middle trunk", "C7"],
            ["Lower trunk", "C8 + T1"],
            ["Lateral cord", "Anterior divisions of upper and middle trunks (C5–C7)"],
            ["Medial cord", "Anterior division of lower trunk (C8–T1)"],
            ["Posterior cord", "Posterior divisions of all three trunks (C5–T1)"],
          ],
        },
        {
          type: "callout",
          variant: "tip",
          title: "Why the cords have these names",
          text: "The cords are named by their position relative to the **second part of the axillary artery**: lateral, medial and posterior to it.",
        },
        {
          type: "callout",
          variant: "exam",
          title: "Anterior vs posterior divisions",
          text: "Anterior divisions supply the flexor (anterior) compartments; posterior divisions supply the extensor (posterior) compartments. That is why the posterior cord gives the radial and axillary nerves.",
        },
      ],
    },
    {
      id: "branches",
      title: "Terminal branches",
      kind: "comparisons",
      depth: "detailed",
      preview: false,
      blocks: [
        {
          type: "table",
          headers: ["Nerve", "Cord", "Usual root value", "Main motor territory"],
          rows: [
            ["Musculocutaneous", "Lateral", "C5–C7", "Anterior compartment of the arm (biceps, brachialis, coracobrachialis)"],
            ["Median", "Lateral + medial", "C6–T1 (often C5–T1)", "Most forearm flexors, thenar muscles, lateral two lumbricals"],
            ["Ulnar", "Medial", "C8–T1 (often with C7)", "Flexor carpi ulnaris, medial half of FDP, most intrinsic hand muscles"],
            ["Axillary", "Posterior", "C5–C6", "Deltoid, teres minor"],
            ["Radial", "Posterior", "C5–T1", "Extensors of the arm and forearm"],
          ],
        },
        { type: "heading", level: 3, text: "Important branches before the cords" },
        {
          type: "list",
          ordered: false,
          items: [
            "**Dorsal scapular nerve** (C5 root): rhomboids and levator scapulae.",
            "**Long thoracic nerve** (C5–C7 roots): serratus anterior. Injury causes a *winged scapula*.",
            "**Suprascapular nerve** (upper trunk, C5–C6): supraspinatus and infraspinatus.",
          ],
        },
      ],
    },
    {
      id: "clinical",
      title: "Clinical relevance",
      kind: "clinical-relevance",
      depth: "clinical",
      preview: false,
      blocks: [
        {
          type: "table",
          headers: ["Injury", "Level", "Typical cause", "Classic picture"],
          rows: [
            ["Erb's palsy", "Upper trunk (C5–C6)", "Excessive separation of head and shoulder, e.g. difficult delivery or a fall on the shoulder", "\"Waiter's tip\": arm adducted and medially rotated, elbow extended, forearm pronated"],
            ["Klumpke's palsy", "Lower trunk (C8–T1)", "Sudden upward pull of the arm, e.g. grabbing a support during a fall", "Claw hand from paralysis of intrinsic hand muscles; Horner syndrome if T1 sympathetic fibres are involved"],
          ],
        },
        {
          type: "callout",
          variant: "clinical",
          title: "Thinking clinically",
          text: "Work out the level from the pattern of weakness and sensory loss, then check it against the root values above. This approach works better than memorising each injury separately.",
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
          question: "Which cord of the brachial plexus gives rise to the axillary nerve?",
          options: ["Lateral cord", "Medial cord", "Posterior cord", "Upper trunk"],
          answerIndex: 2,
          explanation: "The posterior cord, formed from all three posterior divisions, gives the axillary and radial nerves.",
        },
        {
          type: "mcq",
          question: "A newborn after a difficult delivery holds the arm adducted, medially rotated with the forearm pronated. Which part is injured?",
          options: ["Upper trunk (C5–C6)", "Middle trunk (C7)", "Lower trunk (C8–T1)", "Posterior cord"],
          answerIndex: 0,
          explanation:
            "This is the \"waiter's tip\" position of Erb's palsy, caused by injury to the upper trunk (C5–C6) affecting the abductors and lateral rotators of the shoulder and the flexors of the elbow.",
        },
        {
          type: "question",
          kind: "oral",
          question: "Why does injury to the long thoracic nerve cause winging of the scapula?",
          answer:
            "The long thoracic nerve supplies serratus anterior, which holds the medial border of the scapula against the chest wall. When it is paralysed, the medial border lifts away from the thorax, especially when pushing against resistance.",
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
            "Ventral rami C5–T1 → 3 trunks → 6 divisions → 3 cords → 5 terminal branches.",
            "Cords are named relative to the 2nd part of the axillary artery.",
            "Posterior cord → axillary and radial nerves.",
            "Erb's palsy = upper trunk, waiter's tip. Klumpke's palsy = lower trunk, claw hand ± Horner syndrome.",
          ],
        },
      ],
    },
  ],
};
