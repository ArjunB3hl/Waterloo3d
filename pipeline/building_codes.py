"""Curated University of Waterloo building codes, keyed by the EXACT OpenStreetMap building name.

The OSM / Overture building data carries no building codes, so this table adds the short codes students and the
campus map use (MC, DC, DP ...). Curated by hand from the university's published building codes; verify against
https://uwaterloo.ca/map/ before relying on it. Rules:
  * only codes we are confident are the official UW codes - never invent one. When unsure, leave the building out
    (its label then shows the full OSM name, which is always correct);
  * keys must match the OSM `name` exactly (including OSM's own spelling, e.g. 'Commisary'), so a renamed or
    retagged building silently loses its code instead of getting the wrong one;
  * only University of Waterloo buildings (and its affiliated colleges). Wilfrid Laurier University and other
    institutions use their own code systems and are not covered.
"""

# curated, verify against uwaterloo.ca/map
UW_BUILDING_CODES: dict[str, str] = {
    # core academic buildings
    'Mathematics & Computer': 'MC',
    'Mathematics 3': 'M3',
    'William G. Davis Computer Research Centre': 'DC',
    'Dana Porter Library': 'DP',
    'Student Life Centre': 'SLC',
    'Mike & Ophelia Lazaridis Quantum Nano Centre': 'QNC',
    'Centre for Environmental and Information Technology': 'EIT',
    'Douglas Wright Engineering Building': 'DWE',
    'Engineering 2': 'E2',
    'Engineering 3': 'E3',
    'Carl A. Pollock Hall': 'CPH',
    'Engineering 5': 'E5',
    'Engineering 6': 'E6',
    'Pearl Sullivan Engineering Building': 'E7',
    'J. R. Coutts Engineering Lecture Hall': 'RCH',
    'Physics': 'PHY',
    'Biology 1': 'B1',
    'Biology 2': 'B2',
    'Chemistry 2': 'C2',
    'Earth Sciences & Chemistry': 'ESC',
    'Science Teaching Complex': 'STC',
    'Environment 1': 'EV1',
    'Environment 2': 'EV2',
    'Environment 3': 'EV3',
    'J. G. Hagey Hall of the Humanities': 'HH',
    'Modern Languages': 'ML',
    'Arts Lecture Hall': 'AL',
    'Psychology, Anthropology & Sociology': 'PAS',
    'B.C. Matthews Hall': 'BMH',
    'Lyle S. Hallman Institute for Health Promotion': 'LHI',
    'Applied Health Sciences Expansion Building': 'EXP',
    'School of Optometry & Vision Science': 'OPT',
    # services, student and athletics buildings
    'Ira G. Needles Hall': 'NH',
    'Tatham Centre for Co-operative Education and Career Action': 'TC',
    'South Campus Hall': 'SCH',
    'Health Services': 'HS',
    'General Services Complex': 'GSC',
    'Central Services Building': 'CSB',
    'Commisary': 'COM',               # OSM spelling of "Commissary"
    'Energy Research Centre': 'ERC',
    'Federation Hall': 'FED',
    'Physical Activities Complex': 'PAC',
    'Columbia Icefield': 'CIF',
    'Toby Jenkins Applied Health Research Building': 'TJB',
    'East Campus Hall': 'ECH',
    'East Campus 1': 'EC1',
    'East Campus 2': 'EC2',
    'East Campus 3': 'EC3',
    'East Campus 4': 'EC4',
    'East Campus 5': 'EC5',
    # residences and affiliated colleges
    'Ron Eydt Village': 'REV',
    'Mackenzie King Village': 'MKV',
    'Claudette Millar Hall': 'CMH',
    'Conrad Grebel University College': 'CGR',
    'Renison University College': 'REN',
    "St. Jerome's University": 'STJ',         # UW also uses SJ1 / SJ2 for St. Jerome's buildings: verify
    "St. Jerome's Academic Centre SJ2": 'SJ2',  # the OSM name carries the code itself
    'Student Village 1 Central Complex': 'V1',
    'Minota Hagey Residence': 'MHR',
    'UW Place Grand Commons': 'UWP',
    'Graduate House': 'GH',
}


def code_for(name: str) -> str | None:
    """Official UW code for an exact OSM building name, or None."""
    return UW_BUILDING_CODES.get(name)
