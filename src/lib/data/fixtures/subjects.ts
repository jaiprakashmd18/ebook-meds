import type { Subject, Topic } from "@/lib/data/types";

export const fixtureSubjects: Subject[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Anatomy",
    slug: "anatomy",
    description:
      "The structure of the human body, from bones and joints to nerves and vessels. Build a mental map you can recall in viva and dissection hall alike.",
    cover_image: null,
    published: true,
    sort_order: 1,
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    name: "Histology",
    slug: "histology",
    description:
      "Tissues under the microscope. Learn to recognise epithelia, connective tissue, muscle and nerve by the features that actually matter.",
    cover_image: null,
    published: true,
    sort_order: 2,
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    name: "Biochemistry",
    slug: "biochemistry",
    description:
      "Metabolism, enzymes and molecules of life, explained as connected stories rather than lists to memorise.",
    cover_image: null,
    published: true,
    sort_order: 3,
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    name: "Cell Biology",
    slug: "cell-biology",
    description: "How cells are built, how they move materials across membranes and how they communicate.",
    cover_image: null,
    published: true,
    sort_order: 4,
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    name: "Biophysics",
    slug: "biophysics",
    description: "The physical principles behind diffusion, membrane potentials, fluid flow and bioelectricity.",
    cover_image: null,
    published: true,
    sort_order: 5,
  },
  {
    id: "10000000-0000-4000-8000-000000000006",
    name: "Medical Imaging",
    slug: "medical-imaging",
    description: "Foundations of radiography, ultrasound, CT and MRI for first-year students.",
    cover_image: null,
    published: true,
    sort_order: 6,
  },
  {
    id: "10000000-0000-4000-8000-000000000007",
    name: "Molecular Biology",
    slug: "molecular-biology",
    description: "DNA, RNA and proteins: replication, transcription, translation and their regulation.",
    cover_image: null,
    published: true,
    sort_order: 7,
  },
  {
    id: "10000000-0000-4000-8000-000000000008",
    name: "Physiology",
    slug: "physiology",
    description: "How the body works, organ system by organ system, with the mechanisms that examiners love to ask about.",
    cover_image: null,
    published: true,
    sort_order: 8,
  },
];

export const fixtureTopics: Topic[] = [
  { id: "20000000-0000-4000-8000-000000000001", subject_id: fixtureSubjects[0].id, name: "Upper limb", slug: "upper-limb" },
  { id: "20000000-0000-4000-8000-000000000002", subject_id: fixtureSubjects[1].id, name: "Epithelium", slug: "epithelium" },
  { id: "20000000-0000-4000-8000-000000000003", subject_id: fixtureSubjects[2].id, name: "Carbohydrate metabolism", slug: "carbohydrate-metabolism" },
  { id: "20000000-0000-4000-8000-000000000004", subject_id: fixtureSubjects[3].id, name: "Cell membrane", slug: "cell-membrane" },
  { id: "20000000-0000-4000-8000-000000000005", subject_id: fixtureSubjects[7].id, name: "Nerve and muscle", slug: "nerve-and-muscle" },
  { id: "20000000-0000-4000-8000-000000000006", subject_id: fixtureSubjects[7].id, name: "General physiology", slug: "general-physiology" },
];
