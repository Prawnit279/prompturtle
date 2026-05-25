export interface HtsSeedRecord {
  code: string;
  description: string;
  chapter: string;
  section: string;
  dutyRate: string;
  unit: string;
}

/**
 * Representative HTS code sample across common supply chain categories.
 * Full schedule: https://hts.usitc.gov (100k+ codes — use this seed for dev/staging)
 * Production: replace with full USITC bulk download in a separate data pipeline.
 */
export const HTS_SEED_DATA: HtsSeedRecord[] = [
  // Chapter 84 — Machinery
  {
    code:        '8471.30.01',
    description: 'Portable automatic data processing machines, weighing not more than 10 kg',
    chapter:     '84',
    section:     'XVI',
    dutyRate:    'Free',
    unit:        'No.',
  },
  {
    code:        '8471.41.01',
    description:
      'Other automatic data processing machines comprising in the same housing at least a central processing unit and an input and output unit',
    chapter:  '84',
    section:  'XVI',
    dutyRate: 'Free',
    unit:     'No.',
  },
  {
    code:        '8443.31.10',
    description: 'Printers, for use with automatic data processing machines',
    chapter:     '84',
    section:     'XVI',
    dutyRate:    'Free',
    unit:        'No.',
  },
  {
    code:        '8481.80.90',
    description: 'Taps, cocks, valves and similar appliances for pipes, tanks, vats',
    chapter:     '84',
    section:     'XVI',
    dutyRate:    '2%',
    unit:        'No.',
  },
  {
    code:        '8501.10.40',
    description: 'Electric motors of an output not exceeding 37.5 W',
    chapter:     '85',
    section:     'XVI',
    dutyRate:    '6.7%',
    unit:        'No.',
  },

  // Chapter 85 — Electrical Equipment
  {
    code:        '8517.12.00',
    description: 'Telephones for cellular networks or for other wireless networks',
    chapter:     '85',
    section:     'XVI',
    dutyRate:    'Free',
    unit:        'No.',
  },
  {
    code:        '8528.72.64',
    description:
      'Television reception apparatus, LCD flat panel display, not capable of receiving television broadcast signals',
    chapter:  '85',
    section:  'XVI',
    dutyRate: 'Free',
    unit:     'No.',
  },
  {
    code:        '8544.42.90',
    description: 'Electric conductors fitted with connectors, for a voltage not exceeding 1,000 V',
    chapter:     '85',
    section:     'XVI',
    dutyRate:    '2.6%',
    unit:        'No.',
  },

  // Chapter 61/62 — Apparel
  {
    code:        '6109.10.00',
    description: "T-shirts, singlets and other vests, of cotton, knitted or crocheted",
    chapter:     '61',
    section:     'XI',
    dutyRate:    '16.5%',
    unit:        'doz.',
  },
  {
    code:        '6203.42.40',
    description: "Men's or boys' trousers and breeches, of cotton, not bib and brace overalls",
    chapter:     '62',
    section:     'XI',
    dutyRate:    '17%',
    unit:        'doz.',
  },
  {
    code:        '6204.62.40',
    description: "Women's or girls' trousers and breeches, of cotton",
    chapter:     '62',
    section:     'XI',
    dutyRate:    '17%',
    unit:        'doz.',
  },

  // Chapter 39 — Plastics
  {
    code:        '3923.30.00',
    description: 'Carboys, bottles, flasks and similar articles, of plastics',
    chapter:     '39',
    section:     'VII',
    dutyRate:    '3%',
    unit:        'No.',
  },
  {
    code:        '3926.90.99',
    description: 'Other articles of plastics, not elsewhere specified',
    chapter:     '39',
    section:     'VII',
    dutyRate:    '5.3%',
    unit:        'No.',
  },

  // Chapter 73 — Iron & Steel Articles
  {
    code:        '7318.15.20',
    description: 'Screws and bolts of iron or steel, not stainless, threaded',
    chapter:     '73',
    section:     'XV',
    dutyRate:    '6.2%',
    unit:        'kg',
  },
  {
    code:        '7326.90.86',
    description: 'Other articles of iron or steel',
    chapter:     '73',
    section:     'XV',
    dutyRate:    '2.9%',
    unit:        'No.',
  },

  // Chapter 94 — Furniture
  {
    code:        '9401.61.40',
    description:
      'Seats with wooden frames, upholstered, other than garden seats or camping equipment',
    chapter:  '94',
    section:  'XX',
    dutyRate: 'Free',
    unit:     'No.',
  },
  {
    code:        '9403.20.00',
    description: 'Other metal furniture',
    chapter:     '94',
    section:     'XX',
    dutyRate:    'Free',
    unit:        'No.',
  },

  // Chapter 87 — Vehicles
  {
    code:        '8703.23.00',
    description:
      'Motor cars with spark-ignition internal combustion engine, cylinder capacity exceeding 1,500 cc but not exceeding 3,000 cc',
    chapter:  '87',
    section:  'XVII',
    dutyRate: '2.5%',
    unit:     'No.',
  },
  {
    code:        '8708.99.81',
    description: 'Other parts and accessories for motor vehicles',
    chapter:     '87',
    section:     'XVII',
    dutyRate:    '2.5%',
    unit:        'No.',
  },

  // Chapter 30 — Pharmaceuticals
  {
    code:        '3004.90.92',
    description:
      'Medicaments consisting of mixed or unmixed products for therapeutic or prophylactic uses, put up in measured doses',
    chapter:  '30',
    section:  'VI',
    dutyRate: 'Free',
    unit:     'No.',
  },

  // Chapter 02 — Meat
  {
    code:        '0201.10.10',
    description: 'Carcasses and half-carcasses of bovine animals, fresh or chilled',
    chapter:     '02',
    section:     'I',
    dutyRate:    '4.4¢/kg',
    unit:        'kg',
  },
  {
    code:        '0207.12.00',
    description: 'Frozen chickens, not cut in pieces',
    chapter:     '02',
    section:     'I',
    dutyRate:    '8.8¢/kg',
    unit:        'kg',
  },

  // Chapter 08/09 — Fruits & Coffee
  {
    code:        '0805.10.00',
    description: 'Oranges, fresh or dried',
    chapter:     '08',
    section:     'II',
    dutyRate:    '1.9¢/kg',
    unit:        'kg',
  },
  {
    code:        '0901.11.00',
    description: 'Coffee, not roasted, not decaffeinated',
    chapter:     '09',
    section:     'II',
    dutyRate:    'Free',
    unit:        'kg',
  },

  // Chapter 27 — Petroleum
  {
    code:        '2709.00.20',
    description: 'Petroleum oils and oils obtained from bituminous minerals, crude',
    chapter:     '27',
    section:     'V',
    dutyRate:    '10.5¢/bbl',
    unit:        'bbl',
  },
];
