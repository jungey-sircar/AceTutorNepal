"""Static hierarchical question bank metadata used by the API."""

from copy import deepcopy
from typing import Any, Dict, List, Optional

QuestionBankNode = Dict[str, Any]


def leaf(
    node_id: str,
    title: str,
    description: str,
    icon: str,
    question_count: int,
    note_count: int,
) -> QuestionBankNode:
    return {
        'id': node_id,
        'title': title,
        'description': description,
        'icon': icon,
        'questionCount': question_count,
        'noteCount': note_count,
        'updated': 'Recently updated',
        'children': [],
    }


def branch(
    node_id: str,
    title: str,
    description: str,
    icon: str,
    children: List[QuestionBankNode],
    question_count: Optional[int] = None,
    note_count: Optional[int] = None,
) -> QuestionBankNode:
    node: QuestionBankNode = {
        'id': node_id,
        'title': title,
        'description': description,
        'icon': icon,
        'updated': 'Recently updated',
        'children': children,
    }
    if question_count is not None:
        node['questionCount'] = question_count
    if note_count is not None:
        node['noteCount'] = note_count
    return node


QUESTION_BANK_ROOTS: List[QuestionBankNode] = [
    branch(
        'level',
        'Level',
        'Browse academic resources by school and higher education level.',
        'layers',
        [
            leaf('level-class-9', 'Class 9', 'Foundation questions and notes for secondary school.', 'school', 120, 18),
            leaf('level-class-10-see', 'Class 10 (SEE)', 'SEE-focused past questions, model sets, and revision notes.', 'school', 180, 28),
            leaf('level-class-11', 'Class 11', 'Higher secondary resources for concept building.', 'book', 96, 14),
            leaf('level-class-12', 'Class 12', 'Board-oriented practice and chapter-wise notes.', 'book', 112, 16),
            branch(
                'level-bachelor',
                'Bachelor',
                'Undergraduate question bank and program-specific notes.',
                'library',
                [
                    leaf('level-bachelor-bit', 'BIT', 'Information technology question bank and quick notes.', 'desktop', 88, 12),
                    leaf('level-bachelor-bca', 'BCA', 'Computer application resources for semester-wise study.', 'laptop', 94, 14),
                    leaf('level-bachelor-bim', 'BIM', 'Business informatics resources for practical revision.', 'briefcase', 78, 11),
                    leaf('level-bachelor-bbm', 'BBM', 'Management question sets and subject notes.', 'business', 84, 13),
                    leaf('level-bachelor-bbs', 'BBS', 'Commerce-oriented questions and notes.', 'calculator', 91, 13),
                    leaf('level-bachelor-bba', 'BBA', 'Business administration resources for theory and practice.', 'stats-chart', 90, 12),
                    leaf('level-bachelor-bs-physics', 'BS Physics', 'Physics concept notes and numerical practice.', 'moon', 74, 10),
                    leaf('level-bachelor-bs-chemistry', 'BS Chemistry', 'Chemistry problem sets, formulas, and notes.', 'flask', 76, 11),
                    leaf('level-bachelor-bs-geology', 'BS Geology', 'Geology lab, theory, and field-study notes.', 'globe', 70, 9),
                    leaf('level-bachelor-biotechnology', 'Biotechnology', 'Applied science resources for undergraduate learning.', 'leaf', 82, 10),
                    leaf('level-bachelor-food-technology', 'Food Technology', 'Food science questions and laboratory notes.', 'leaf', 68, 9),
                    leaf('level-bachelor-engineering', 'Engineering', 'Engineering fundamentals and semester-wise archives.', 'construct', 140, 22),
                ],
            ),
            branch(
                'level-master',
                'Master',
                'Postgraduate question bank and advanced notes.',
                'school',
                [
                    leaf('level-master-mit', 'MIT', 'Master of Information Technology resources.', 'desktop', 66, 9),
                    leaf('level-master-mca', 'MCA', 'Master of Computer Applications question bank.', 'laptop', 72, 10),
                    leaf('level-master-mba', 'MBA', 'Management case studies, questions, and notes.', 'briefcase', 74, 12),
                    leaf('level-master-msc-csit', 'MSc CSIT', 'Advanced computer science and IT study packs.', 'code-slash', 63, 9),
                    leaf('level-master-msc-physics', 'MSc Physics', 'Advanced physics concepts and numerical sets.', 'moon', 58, 8),
                    leaf('level-master-msc-chemistry', 'MSc Chemistry', 'Postgraduate chemistry problems and notes.', 'flask', 60, 8),
                ],
            ),
        ],
    ),
    branch(
        'university-board',
        'University / Board',
        'Filter academic resources by university or board affiliation.',
        'business',
        [
            leaf('university-board-neb', 'NEB', 'National board materials and SEE / +2 resources.', 'school', 180, 24),
            leaf('university-board-tu', 'Tribhuvan University (TU)', 'TU-affiliated question bank and notes.', 'library', 210, 30),
            leaf('university-board-ku', 'Kathmandu University', 'KU semester sets and curated notes.', 'business', 98, 14),
            leaf('university-board-pu', 'Pokhara University', 'Pokhara University practice archives.', 'location', 86, 12),
            leaf('university-board-purbanchal', 'Purbanchal University', 'Program-wise questions and study notes.', 'map', 82, 11),
            leaf('university-board-mid-western', 'Mid-Western University', 'University-level notes and question sets.', 'book', 74, 10),
            leaf('university-board-far-western', 'Far-Western University', 'Affiliated academic archives and notes.', 'book-outline', 68, 9),
        ],
    ),
    branch(
        'faculty-program',
        'Faculty / Program',
        'Browse resources by faculty, degree, and program family.',
        'grid',
        [
            branch(
                'faculty-bachelor',
                'Bachelor',
                'Bachelor-level programs with dedicated content bundles.',
                'library',
                [
                    leaf('faculty-bachelor-bit', 'BIT', 'Semester-wise BIT question bank and notes.', 'desktop', 88, 12),
                    leaf('faculty-bachelor-bca', 'BCA', 'BCA past questions, notes, and model sets.', 'laptop', 94, 14),
                    leaf('faculty-bachelor-bim', 'BIM', 'BIM revision notes and question bank.', 'briefcase', 78, 11),
                    leaf('faculty-bachelor-bbm', 'BBM', 'BBM management resources.', 'business', 84, 13),
                    leaf('faculty-bachelor-bbs', 'BBS', 'BBS commerce question bank and notes.', 'calculator', 91, 13),
                    leaf('faculty-bachelor-bba', 'BBA', 'BBA business studies resources.', 'stats-chart', 90, 12),
                    leaf('faculty-bachelor-bs-physics', 'BS Physics', 'Physics lab, theory, and numerical resources.', 'moon', 74, 10),
                    leaf('faculty-bachelor-bs-chemistry', 'BS Chemistry', 'Chemistry notes, reactions, and practice.', 'flask', 76, 11),
                    leaf('faculty-bachelor-bs-geology', 'BS Geology', 'Geology field and theory notes.', 'globe', 70, 9),
                    leaf('faculty-bachelor-biotechnology', 'Biotechnology', 'Biotech course notes and practice sets.', 'leaf', 82, 10),
                    leaf('faculty-bachelor-food-technology', 'Food Technology', 'Food tech notes, diagrams, and questions.', 'leaf', 68, 9),
                    leaf('faculty-bachelor-engineering', 'Engineering', 'Engineering subject banks for each semester.', 'construct', 140, 22),
                ],
            ),
            branch(
                'faculty-master',
                'Master',
                'Master-level advanced question bank and notes.',
                'school',
                [
                    leaf('faculty-master-mit', 'MIT', 'Master of Information Technology archives.', 'desktop', 66, 9),
                    leaf('faculty-master-mca', 'MCA', 'Master of Computer Applications resources.', 'laptop', 72, 10),
                    leaf('faculty-master-mba', 'MBA', 'MBA case-based questions and notes.', 'briefcase', 74, 12),
                    leaf('faculty-master-msc-csit', 'MSc CSIT', 'CSIT advanced reading and question bank.', 'code-slash', 63, 9),
                    leaf('faculty-master-msc-physics', 'MSc Physics', 'Advanced physics study materials.', 'moon', 58, 8),
                    leaf('faculty-master-msc-chemistry', 'MSc Chemistry', 'Chemistry advanced notes and questions.', 'flask', 60, 8),
                ],
            ),
        ],
    ),
    branch(
        'year-semester',
        'Year / Semester',
        'Jump directly into a semester or yearly study plan.',
        'calendar',
        [
            leaf('year-semester-1', '1st Semester', 'Introductory semester resources and notes.', 'calendar', 64, 10),
            leaf('year-semester-2', '2nd Semester', 'Second semester practice and revision material.', 'calendar', 66, 10),
            leaf('year-semester-3', '3rd Semester', 'Intermediate semester question bank.', 'calendar', 68, 11),
            leaf('year-semester-4', '4th Year', 'Year-end and annual assessment resources.', 'calendar', 70, 12),
        ],
    ),
    branch(
        'subject',
        'Subject',
        'Browse by subject and open question banks or notes instantly.',
        'bookmarks',
        [
            leaf('subject-c-programming', 'C Programming', 'Syntax, loops, functions, and practice questions.', 'code-slash', 112, 16),
            leaf('subject-dbms', 'DBMS', 'Database theory, SQL, and question sets.', 'server', 108, 15),
            leaf('subject-mathematics', 'Mathematics', 'Concept notes, derivations, and problem sets.', 'calculator', 140, 20),
            leaf('subject-physics', 'Physics', 'Formula sheets, concept notes, and numericals.', 'moon', 124, 18),
            leaf('subject-statistics', 'Statistics', 'Descriptive and inferential statistics resources.', 'stats-chart', 102, 14),
            leaf('subject-operating-system', 'Operating System', 'Processes, memory, and OS theory resources.', 'hardware-chip', 110, 15),
            leaf('subject-data-structures', 'Data Structures', 'Lists, trees, graphs, and algorithm notes.', 'git-branch', 118, 16),
            leaf('subject-networking', 'Networking', 'Network layers, protocols, and practice questions.', 'wifi', 104, 14),
        ],
    ),
]


def _find_node(nodes: List[QuestionBankNode], target_id: str, trail: Optional[List[QuestionBankNode]] = None) -> Optional[Dict[str, Any]]:
    trail = trail or []
    for node in nodes:
        path = trail + [node]
        if node['id'] == target_id:
            return {'node': node, 'breadcrumbs': path}
        children = node.get('children', [])
        if children:
            found = _find_node(children, target_id, path)
            if found:
                return found
    return None


def get_question_bank_roots() -> List[QuestionBankNode]:
    return deepcopy(QUESTION_BANK_ROOTS)


def get_question_bank_node(node_id: str) -> Optional[Dict[str, Any]]:
    found = _find_node(QUESTION_BANK_ROOTS, node_id)
    return deepcopy(found) if found else None

