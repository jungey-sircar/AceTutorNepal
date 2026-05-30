export interface QuestionBankNode {
  id: string;
  title: string;
  description: string;
  icon: string;
  questionCount?: number;
  noteCount?: number;
  updated?: string;
  children?: QuestionBankNode[];
}

const buildLeaf = (
  id: string,
  title: string,
  description: string,
  icon: string,
  questionCount: number,
  noteCount: number,
): QuestionBankNode => ({
  id,
  title,
  description,
  icon,
  questionCount,
  noteCount,
  updated: 'Recently updated',
});

export const questionBankRoots: QuestionBankNode[] = [
  {
    id: 'level',
    title: 'Level',
    description: 'Browse academic resources by school and higher education level.',
    icon: 'layers',
    children: [
      buildLeaf('level-class-9', 'Class 9', 'Foundation questions and notes for secondary school.', 'school', 120, 18),
      buildLeaf('level-class-10-see', 'Class 10 (SEE)', 'SEE-focused past questions, model sets, and revision notes.', 'school', 180, 28),
      buildLeaf('level-class-11', 'Class 11', 'Higher secondary resources for concept building.', 'book', 96, 14),
      buildLeaf('level-class-12', 'Class 12', 'Board-oriented practice and chapter-wise notes.', 'book', 112, 16),
      {
        id: 'level-bachelor',
        title: 'Bachelor',
        description: 'Undergraduate question bank and program-specific notes.',
        icon: 'library',
        children: [
          buildLeaf('level-bachelor-bit', 'BIT', 'Information technology question bank and quick notes.', 'desktop', 88, 12),
          buildLeaf('level-bachelor-bca', 'BCA', 'Computer application resources for semester-wise study.', 'laptop', 94, 14),
          buildLeaf('level-bachelor-bim', 'BIM', 'Business informatics resources for practical revision.', 'briefcase', 78, 11),
          buildLeaf('level-bachelor-bbm', 'BBM', 'Management question sets and subject notes.', 'business', 84, 13),
          buildLeaf('level-bachelor-bbs', 'BBS', 'Commerce-oriented questions and notes.', 'calculator', 91, 13),
          buildLeaf('level-bachelor-bba', 'BBA', 'Business administration resources for theory and practice.', 'stats-chart', 90, 12),
          buildLeaf('level-bachelor-bs-physics', 'BS Physics', 'Physics concept notes and numerical practice.', 'moon', 74, 10),
          buildLeaf('level-bachelor-bs-chemistry', 'BS Chemistry', 'Chemistry problem sets, formulas, and notes.', 'flask', 76, 11),
          buildLeaf('level-bachelor-bs-geology', 'BS Geology', 'Geology lab, theory, and field-study notes.', 'globe', 70, 9),
          buildLeaf('level-bachelor-biotechnology', 'Biotechnology', 'Applied science resources for undergraduate learning.', 'leaf', 82, 10),
          buildLeaf('level-bachelor-food-technology', 'Food Technology', 'Food science questions and laboratory notes.', 'leaf', 68, 9),
          buildLeaf('level-bachelor-engineering', 'Engineering', 'Engineering fundamentals and semester-wise archives.', 'construct', 140, 22),
        ],
      },
      {
        id: 'level-master',
        title: 'Master',
        description: 'Postgraduate question bank and advanced notes.',
        icon: 'school',
        children: [
          buildLeaf('level-master-mit', 'MIT', 'Master of Information Technology resources.', 'desktop', 66, 9),
          buildLeaf('level-master-mca', 'MCA', 'Master of Computer Applications question bank.', 'laptop', 72, 10),
          buildLeaf('level-master-mba', 'MBA', 'Management case studies, questions, and notes.', 'briefcase', 74, 12),
          buildLeaf('level-master-msc-csit', 'MSc CSIT', 'Advanced computer science and IT study packs.', 'code-slash', 63, 9),
          buildLeaf('level-master-msc-physics', 'MSc Physics', 'Advanced physics concepts and numerical sets.', 'moon', 58, 8),
          buildLeaf('level-master-msc-chemistry', 'MSc Chemistry', 'Postgraduate chemistry problems and notes.', 'flask', 60, 8),
        ],
      },
    ],
  },
  {
    id: 'university-board',
    title: 'University / Board',
    description: 'Filter academic resources by university or board affiliation.',
    icon: 'business',
    children: [
      buildLeaf('university-board-neb', 'NEB', 'National board materials and SEE / +2 resources.', 'school', 180, 24),
      buildLeaf('university-board-tu', 'Tribhuvan University (TU)', 'TU-affiliated question bank and notes.', 'library', 210, 30),
      buildLeaf('university-board-ku', 'Kathmandu University', 'KU semester sets and curated notes.', 'business', 98, 14),
      buildLeaf('university-board-pu', 'Pokhara University', 'Pokhara University practice archives.', 'location', 86, 12),
      buildLeaf('university-board-purbanchal', 'Purbanchal University', 'Program-wise questions and study notes.', 'map', 82, 11),
      buildLeaf('university-board-mid-western', 'Mid-Western University', 'University-level notes and question sets.', 'book', 74, 10),
      buildLeaf('university-board-far-western', 'Far-Western University', 'Affiliated academic archives and notes.', 'book-outline', 68, 9),
    ],
  },
  {
    id: 'faculty-program',
    title: 'Faculty / Program',
    description: 'Browse resources by faculty, degree, and program family.',
    icon: 'grid',
    children: [
      {
        id: 'faculty-bachelor',
        title: 'Bachelor',
        description: 'Bachelor-level programs with dedicated content bundles.',
        icon: 'library',
        children: [
          buildLeaf('faculty-bachelor-bit', 'BIT', 'Semester-wise BIT question bank and notes.', 'desktop', 88, 12),
          buildLeaf('faculty-bachelor-bca', 'BCA', 'BCA past questions, notes, and model sets.', 'laptop', 94, 14),
          buildLeaf('faculty-bachelor-bim', 'BIM', 'BIM revision notes and question bank.', 'briefcase', 78, 11),
          buildLeaf('faculty-bachelor-bbm', 'BBM', 'BBM management resources.', 'business', 84, 13),
          buildLeaf('faculty-bachelor-bbs', 'BBS', 'BBS commerce question bank and notes.', 'calculator', 91, 13),
          buildLeaf('faculty-bachelor-bba', 'BBA', 'BBA business studies resources.', 'stats-chart', 90, 12),
          buildLeaf('faculty-bachelor-bs-physics', 'BS Physics', 'Physics lab, theory, and numerical resources.', 'moon', 74, 10),
          buildLeaf('faculty-bachelor-bs-chemistry', 'BS Chemistry', 'Chemistry notes, reactions, and practice.', 'flask', 76, 11),
          buildLeaf('faculty-bachelor-bs-geology', 'BS Geology', 'Geology field and theory notes.', 'globe', 70, 9),
          buildLeaf('faculty-bachelor-biotechnology', 'Biotechnology', 'Biotech course notes and practice sets.', 'leaf', 82, 10),
          buildLeaf('faculty-bachelor-food-technology', 'Food Technology', 'Food tech notes, diagrams, and questions.', 'leaf', 68, 9),
          buildLeaf('faculty-bachelor-engineering', 'Engineering', 'Engineering subject banks for each semester.', 'construct', 140, 22),
        ],
      },
      {
        id: 'faculty-master',
        title: 'Master',
        description: 'Master-level advanced question bank and notes.',
        icon: 'school',
        children: [
          buildLeaf('faculty-master-mit', 'MIT', 'Master of Information Technology archives.', 'desktop', 66, 9),
          buildLeaf('faculty-master-mca', 'MCA', 'Master of Computer Applications resources.', 'laptop', 72, 10),
          buildLeaf('faculty-master-mba', 'MBA', 'MBA case-based questions and notes.', 'briefcase', 74, 12),
          buildLeaf('faculty-master-msc-csit', 'MSc CSIT', 'CSIT advanced reading and question bank.', 'code-slash', 63, 9),
          buildLeaf('faculty-master-msc-physics', 'MSc Physics', 'Advanced physics study materials.', 'moon', 58, 8),
          buildLeaf('faculty-master-msc-chemistry', 'MSc Chemistry', 'Chemistry advanced notes and questions.', 'flask', 60, 8),
        ],
      },
    ],
  },
  {
    id: 'year-semester',
    title: 'Year / Semester',
    description: 'Jump directly into a semester or yearly study plan.',
    icon: 'calendar',
    children: [
      buildLeaf('year-semester-1', '1st Semester', 'Introductory semester resources and notes.', 'calendar', 64, 10),
      buildLeaf('year-semester-2', '2nd Semester', 'Second semester practice and revision material.', 'calendar', 66, 10),
      buildLeaf('year-semester-3', '3rd Semester', 'Intermediate semester question bank.', 'calendar', 68, 11),
      buildLeaf('year-semester-4', '4th Year', 'Year-end and annual assessment resources.', 'calendar', 70, 12),
    ],
  },
  {
    id: 'subject',
    title: 'Subject',
    description: 'Browse by subject and open question banks or notes instantly.',
    icon: 'bookmarks',
    children: [
      buildLeaf('subject-c-programming', 'C Programming', 'Syntax, loops, functions, and practice questions.', 'code-slash', 112, 16),
      buildLeaf('subject-dbms', 'DBMS', 'Database theory, SQL, and question sets.', 'server', 108, 15),
      buildLeaf('subject-mathematics', 'Mathematics', 'Concept notes, derivations, and problem sets.', 'calculator', 140, 20),
      buildLeaf('subject-physics', 'Physics', 'Formula sheets, concept notes, and numericals.', 'planet', 124, 18),
      buildLeaf('subject-statistics', 'Statistics', 'Descriptive and inferential statistics resources.', 'stats-chart', 102, 14),
      buildLeaf('subject-operating-system', 'Operating System', 'Processes, memory, and OS theory resources.', 'hardware-chip', 110, 15),
      buildLeaf('subject-data-structures', 'Data Structures', 'Lists, trees, graphs, and algorithm notes.', 'git-branch', 118, 16),
      buildLeaf('subject-networking', 'Networking', 'Network layers, protocols, and practice questions.', 'wifi', 104, 14),
    ],
  },
];

type FindResult = {
  node: QuestionBankNode;
  breadcrumbs: QuestionBankNode[];
} | null;

function findNode(nodes: QuestionBankNode[], targetId: string, breadcrumbs: QuestionBankNode[] = []): FindResult {
  for (const node of nodes) {
    const trail = [...breadcrumbs, node];
    if (node.id === targetId) {
      return { node, breadcrumbs: trail };
    }

    if (node.children?.length) {
      const result = findNode(node.children, targetId, trail);
      if (result) {
        return result;
      }
    }
  }

  return null;
}

export function getQuestionBankNode(nodeId: string): FindResult {
  return findNode(questionBankRoots, nodeId);
}

export function getChildPreviewTitles(node: QuestionBankNode, limit = 3): string[] {
  return (node.children || []).slice(0, limit).map((child) => child.title);
}

