/**
 * Sources for every statistic on the site (see the research notes). Only
 * figures checked against a primary source, or clearly attributed secondary
 * citations, are used.
 */

export interface Source {
  id: string;
  label: string;
  detail: string;
  url: string;
}

export const SOURCES: Source[] = [
  {
    id: 'nidcd',
    label: 'NIDCD, Quick Statistics About Hearing (2024)',
    detail:
      'More than 90% of deaf children are born to hearing parents; see also Mitchell & Karchmer (2004), Sign Language Studies.',
    url: 'https://www.nidcd.nih.gov/health/statistics/quick-statistics-hearing',
  },
  {
    id: 'lieberman',
    label: 'Lieberman, Mitchiner & Pontecorvo (2024), citing the Gallaudet Research Institute survey (2013–14)',
    detail: '22.9% of families with deaf children regularly sign at home.',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10785677/',
  },
  {
    id: 'cdc',
    label: 'CDC, 2022 Hearing Screening & Follow-up Survey summary',
    detail: '6,272 US infants born in 2022 were identified as deaf or hard of hearing.',
    url: 'https://archive.cdc.gov/www_cdc_gov/ncbddd/hearingloss/2022-data/01-data-summary.html',
  },
  {
    id: 'caselli',
    label: 'Caselli, Pyers & Lieberman (2021), Journal of Pediatrics',
    detail: 'Deaf children of hearing parents exposed to ASL before 6 months had age-expected vocabularies.',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8085057/',
  },
  {
    id: 'mla',
    label: 'Modern Language Association, fall 2021 enrollment census',
    detail: 'ASL is the third most-studied language in US higher education, with 107,899 enrollments.',
    url: 'https://www.mla.org/content/download/191329/file/2021-Enrollment-Press-Release.pdf',
  },
  {
    id: 'shield',
    label: 'Shield & Meier (2018), Frontiers in Psychology',
    detail:
      'Hearing non-signers copying a face-to-face model erred on 24.3% of sideways movements; with a model matched to their perspective, errors fell from 20.6% to 0.9%.',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5988899/',
  },
  {
    id: 'shao',
    label: 'Shao et al. (2020), Proc. ACM IMWUT',
    detail:
      'Mixed-reality ASL practice with first- and third-person views of the learner’s own hands beat desktop video (N = 60).',
    url: 'https://dl.acm.org/doi/abs/10.1145/3432211',
  },
  {
    id: 'hsieh',
    label: 'Hsieh et al. (2026), CHI',
    detail: 'Ghost-hand guidance that fades with performance beat static guidance on accuracy and retention.',
    url: 'https://arxiv.org/abs/2603.06253',
  },
];

export function sourceIndex(id: string): number {
  return SOURCES.findIndex((s) => s.id === id) + 1;
}
